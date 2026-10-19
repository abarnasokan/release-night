import {z} from 'zod';
import type {Environment} from './domain/pipeline';

const deploymentId=z.string().regex(/^dpl_[a-zA-Z0-9]+$/).max(100);
const identity={release_id:z.uuid(),revision:z.number().int().positive(),suite_revision:z.number().int().positive()};
export const deployRequest=z.discriminatedUnion('action',[
    z.object({...identity,action:z.literal('start'),environment:z.enum(['dev','staging','prod']),predecessor_id:deploymentId.nullable()}).strict(),
    z.object({...identity,action:z.literal('status'),deployment_id:deploymentId}).strict(),
]);
export type DeployRequest=z.infer<typeof deployRequest>;
export type DeployIdentity={release_id:string;revision:number;suite_revision:number;owner_id:string};
export type VercelJob={id:string;environment:Environment;state:string;url:string;commit:string|null;created_at:string;project:string};
export type DeploySettings={token:string;projectId:string;teamId?:string;repository:string;emails:string[]};
export class DeployError extends Error{constructor(message:string,public status=502){super(message);}}
export function deploySettings(env:Record<string,string|undefined>=process.env):DeploySettings|null{
    if(!env.DEPLOY_VERCEL_TOKEN||!env.DEPLOY_VERCEL_PROJECT_ID||!env.DEPLOY_ALLOWED_EMAILS)return null;
    return {token:env.DEPLOY_VERCEL_TOKEN,projectId:env.DEPLOY_VERCEL_PROJECT_ID,teamId:env.DEPLOY_VERCEL_TEAM_ID,repository:env.DEPLOY_GITHUB_REPOSITORY||'abarnasokan/simple-app',emails:env.DEPLOY_ALLOWED_EMAILS.split(',').map(email=>email.trim().toLowerCase()).filter(Boolean)};
}
export function deployAccess(email:string|undefined,confirmed:boolean,settings:DeploySettings|null){return !!settings&&confirmed&&!!email&&settings.emails.includes(email.toLowerCase());}
export function deploymentMetadata(identity:DeployIdentity,environment:Environment){return {releaseNightOwner:identity.owner_id,releaseNightRelease:identity.release_id,releaseNightRevision:String(identity.revision),releaseNightSuite:String(identity.suite_revision),releaseNightEnvironment:environment};}
type ProviderDeployment={id:string;projectId:string;readyState:string;url:string;createdAt?:number;created?:number;aliasError?:unknown;aliasAssigned?:boolean|number;meta?:Record<string,string>;gitSource?:{sha?:string;repoId?:string|number}};
type ProviderProject={id:string;name:string;link?:{type:string;repoId:string|number;org:string;repo:string;productionBranch?:string}};
export function matchesDeployment(deployment:ProviderDeployment,identity:DeployIdentity,projectId:string,matchSuite=true){
    return deployment.projectId===projectId&&deployment.meta?.releaseNightOwner===identity.owner_id&&deployment.meta?.releaseNightRelease===identity.release_id&&deployment.meta?.releaseNightRevision===String(identity.revision)&&(!matchSuite||deployment.meta?.releaseNightSuite===String(identity.suite_revision));
}
export function publicJob(deployment:ProviderDeployment,project:string):VercelJob{
    const environment=deployment.meta?.releaseNightEnvironment;
    if(!['dev','staging','prod'].includes(environment||''))throw new DeployError('Deployment has no valid Release Night environment.');
    if(!/^dpl_[a-zA-Z0-9]+$/.test(deployment.id)||! /^[a-zA-Z0-9.-]+\.vercel\.app$/.test(deployment.url))throw new DeployError('Vercel returned an invalid deployment identity.');
    const state=deployment.aliasError?'ERROR':deployment.readyState==='READY'&&deployment.aliasAssigned===false?'BUILDING':deployment.readyState;
    return {id:deployment.id,environment:environment as Environment,state,url:`https://${deployment.url}`,commit:deployment.gitSource?.sha||deployment.meta?.githubCommitSha||null,created_at:new Date(deployment.createdAt??deployment.created??Date.now()).toISOString(),project};
}
export function vercelClient(settings:DeploySettings,transport:typeof fetch=fetch){
    async function request<T>(path:string,body?:object):Promise<T>{
        const url=new URL(path,'https://api.vercel.com');if(settings.teamId)url.searchParams.set('teamId',settings.teamId);
        if(body)url.searchParams.set('forceNew','1');
        const response=await transport(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${settings.token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(20000)});
        if(!response.ok)throw new DeployError(response.status===401||response.status===403?'Vercel denied access. Check the deployment token and team scope.':response.status===429?'Vercel request limit reached. Try again later.':'Vercel could not complete this request. Check the target project, Git connection, and build logs.');
        return await response.json() as T;
    }
    async function project(){
        const value=await request<ProviderProject>(`/v9/projects/${encodeURIComponent(settings.projectId)}`);
        const link=value.link;
        if(!value.id||!link||link.type!=='github'||!link.repoId||`${link.org}/${link.repo}`.toLowerCase()!==settings.repository.toLowerCase())throw new DeployError('The target project must be linked to the configured simple-app GitHub repository.',409);
        return value;
    }
    async function load(id:string,identity:DeployIdentity,projectId:string,matchSuite=true){
        const value=await request<ProviderDeployment>(`/v13/deployments/${encodeURIComponent(id)}`);
        if(!matchesDeployment(value,identity,projectId,matchSuite))throw new DeployError('This deployment does not belong to the current release and suite.',404);
        return value;
    }
    return {
        async status(id:string,identity:DeployIdentity){const target=await project();return publicJob(await load(id,identity,target.id),target.name);},
        async start(environment:Environment,identity:DeployIdentity,predecessorId:string|null){
            const target=await project(),link=target.link!;
            const branch=environment==='prod'?link.productionBranch||'main':environment;
            let sha:string|undefined;
            if(environment!=='dev'){
                if(!predecessorId)throw new DeployError('Deploy and verify the preceding environment first.',409);
                const previous=await load(predecessorId,identity,target.id,false);
                if(previous.meta?.releaseNightEnvironment!==(environment==='staging'?'dev':'staging')||publicJob(previous,target.name).state!=='READY')throw new DeployError('The preceding environment must have a ready deployment for this release.',409);
                sha=previous.gitSource?.sha||previous.meta?.githubCommitSha;
                if(!sha||!/^[a-f0-9]{40}$/i.test(sha))throw new DeployError('The preceding deployment has no resolved Git commit. Refresh its status before promoting.',409);
            }
            const value=await request<ProviderDeployment>('/v13/deployments',{name:target.name,project:target.id,...(environment==='prod'?{target:'production'}:{}),gitSource:{type:'github',repoId:String(link.repoId),ref:branch,...(sha?{sha}:{})},meta:deploymentMetadata(identity,environment)});
            // Some creation responses omit metadata; the values originate in this request.
            if(!value.url)return publicJob(await load(value.id,identity,target.id),target.name);
            return publicJob({...value,meta:{...value.meta,...deploymentMetadata(identity,environment)}},target.name);
        },
    };
}
