export function prepareHonors(data, members, id) {
  if (!Object.hasOwn(data,'championships')) return data;
  let championships=data.championships;
  if(typeof championships==='string') { try { championships=JSON.parse(championships); } catch { throw new Error('Invalid championship entries'); } }
  if(!Array.isArray(championships)) throw new Error('Invalid championship entries');
  const years=new Set();
  championships=championships.map(entry=>{
    const raw=entry?.year;
    if(!(typeof raw==='number'||typeof raw==='string') || !/^\d{4}$/.test(String(raw)) || !Number.isInteger(Number(raw))) throw new Error('Championship year must be a four-digit integer');
    const year=Number(raw);
    if(year<1000||year>9999)throw new Error('Championship year must be a four-digit integer');
    if(years.has(year))throw new Error(`Year ${year} is listed more than once`);
    if(members.some(member=>member.id!==id&&(member.championships||[]).some(honor=>honor.year===year)))throw new Error(`Year ${year} already has a champion`);
    years.add(year);return {year,note:typeof entry.note==='string'?entry.note.trim():''};
  }).sort((a,b)=>a.year-b.year);
  return {...data,championships};
}
export const memberChampions=members=>members.flatMap(member=>(member.championships||[]).map(honor=>({...honor,member}))).sort((a,b)=>a.year-b.year);
export const fallenHeroes=members=>members.filter(member=>member.fallenHero===true);
