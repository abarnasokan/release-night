export const ENVIRONMENTS = [
    { id: 'dev', label: 'Development', short: 'Dev', description: 'Verify the build in development.' },
    { id: 'staging', label: 'Staging', short: 'Staging', description: 'Validate the release before production.' },
    { id: 'prod', label: 'Production', short: 'Prod', description: 'Record the production rollout.' },
] as const;
export type Environment = typeof ENVIRONMENTS[number]['id'];
