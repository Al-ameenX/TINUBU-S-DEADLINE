import { getUser } from '@netlify/identity';
import { and, eq, desc, sql } from 'drizzle-orm';
import { database } from '../../db/index.js';
import { results, reviews } from '../../db/schema.js';
import directory from '../../public/assets/lgas.json' with { type: 'json' };
function reply(data: unknown, status = 200) { return Response.json(data, {status, headers: {'Cache-Control':'no-store'}}); }
export default async (req: Request) => {
 try {
  const db = database();
  if (req.method === 'GET') {
   const id = new URL(req.url).searchParams.get('id');
   const rows = await db.select().from(results);
   const history = id ? await db.select().from(reviews).where(eq(reviews.resultId,id)).orderBy(desc(reviews.createdAt)) : [];
   return reply({results: rows.map(({uploader,reviewer,...r})=>r),history:history.map(({actor,...r})=>r)});
  }
  if (!['POST','PATCH'].includes(req.method)) return reply({error:'Method not allowed'},405);
  const user = await getUser();
  if (!user) return reply({error:'Sign in to continue.'},401);
  const roles = user.roles || [];
  if (!roles.some(r=>['admin','reviewer'].includes(r))) return reply({error:'An admin or reviewer role is required.'},403);
  const raw = await req.text();
  if(raw.length>1000000) return reply({error:'Upload must be smaller than 1 MB.'},413);
  let body; try {body=JSON.parse(raw);} catch {return reply({error:'Invalid JSON.'},400);}
  if(!body||typeof body!=='object') return reply({error:'Supply a JSON object.'},400);
  if(req.method==='POST') {
   if(!roles.includes('admin')) return reply({error:'Only administrators can upload.'},403);
   const rows=body.results;
   if(!Array.isArray(rows)||!rows.length||rows.length>774) return reply({error:'Upload 1–774 result records.'},400);
   const ids=new Set<string>(); const clean: (typeof results.$inferInsert)[]=[];
   for(let i=0;i<rows.length;i++) {
    const r=rows[i]; const fail=(message:string)=>reply({error:`Row ${i+1}: ${message}`},400);
    if(!r||typeof r!=='object') return fail('Invalid record.');
    const lgas=(directory as Record<string,string[]>)[r.state];
    if(!Array.isArray(lgas)||!lgas.includes(r.lga)) return fail('Unknown state or LGA. Use the directory names.');
    const id=`${r.state}/${r.lga}`;
    if(ids.has(id)) return fail('Duplicate LGA.'); ids.add(id);
    const count=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=2147483647;
    if(![r.registered,r.accredited,r.rejected].every(count)) return fail('Voter counts must be non-negative whole numbers.');
    if(!r.votes||Array.isArray(r.votes)||typeof r.votes!=='object'||!Object.keys(r.votes).length||Object.keys(r.votes).length>30||!Object.entries(r.votes).every(([k,v])=>/^[A-Z][A-Z0-9-]{0,15}$/.test(k)&&count(v))) return fail('Supply party codes and whole-number vote totals.');
    const valid=Object.values(r.votes).reduce<number>((s,v)=>s+Number(v),0);
    if(r.accredited>r.registered||valid+r.rejected>r.accredited) return fail('Ballots cannot exceed accredited voters; accreditation cannot exceed registration.');
    try {if(typeof r.source!=='string'||r.source.length>2000||new URL(r.source).protocol!=='https:') throw Error();}catch{return fail('A public HTTPS source-document URL is required.');}
    clean.push({id,state:r.state,lga:r.lga,registered:r.registered,accredited:r.accredited,rejected:r.rejected,votes:r.votes,source:r.source,uploader:user.id});
   }
   await db.transaction(async tx=>{
    const saved=await tx.insert(results).values(clean).onConflictDoUpdate({target:results.id,set:{
     registered:sql`excluded.registered`,accredited:sql`excluded.accredited`,rejected:sql`excluded.rejected`,
     votes:sql`excluded.votes`,source:sql`excluded.source`,uploader:sql`excluded.uploader`,
     version:sql`${results.version} + 1`,status:'pending',reviewer:null,notes:'',updatedAt:new Date()
    }}).returning();
    await tx.insert(reviews).values(saved.map(row=>({resultId:row.id,version:row.version,action:'uploaded',actor:user.id,notes:'Uploaded for editorial review.'})));
   });
   return reply({message:`${clean.length} results uploaded for review.`});
  }
  if(typeof body.id!=='string'||!['verified','disputed'].includes(body.status)||typeof body.notes!=='string'||body.notes.trim().length<10||body.notes.length>3000||!Number.isInteger(body.version)) return reply({error:'Choose a decision and add a review note of 10–3,000 characters.'},400);
  const updated=await db.transaction(async tx=>{
   const [row]=await tx.update(results).set({status:body.status,notes:body.notes.trim(),reviewer:user.id,updatedAt:new Date(),version:body.version+1}).where(and(eq(results.id,body.id),eq(results.version,body.version))).returning();
   if(!row) return null;
   await tx.insert(reviews).values({resultId:body.id,version:row.version,action:body.status,actor:user.id,notes:body.notes.trim()});return row;
  });
  return updated?reply({message:'Review recorded.'}):reply({error:'This result changed. Refresh before reviewing.'},409);
 }catch{return reply({error:'Results service is temporarily unavailable. Please retry.'},503);}
};
export const config={path:'/api/results'};
