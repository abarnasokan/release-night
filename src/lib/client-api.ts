export async function postJson(url: string, body: object) {
    const response = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    let data;
    try { data=await response.json(); } catch { throw Error('The server returned an unreadable response. Check the dev-server terminal.'); }
    if (!response.ok) throw Error(data.error || 'Request failed. Retry.');
    return data;
}
