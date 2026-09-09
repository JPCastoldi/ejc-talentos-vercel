import { NextResponse } from "next/server";
import postgres from "postgres";

// Vercel provides DATABASE_URL; the fallback also supports direct Neon storage
// connections when the alias has not yet been created in a deployment.
const connectionString = () => process.env.DATABASE_URL || process.env.STORAGE_DATABASE_URL;
const db = () => postgres(connectionString()!, { ssl: "require", max: 1 });
async function setup(sql: ReturnType<typeof postgres>) {
  await sql`CREATE TABLE IF NOT EXISTS ejc_people (id BIGINT PRIMARY KEY, data JSONB NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ejc_settings (key TEXT PRIMARY KEY, data JSONB NOT NULL)`;
}
async function removeFromEvent(sql: ReturnType<typeof postgres>, personId: number) {
  const rows=await sql`SELECT data FROM ejc_settings WHERE key='eventAssignments' LIMIT 1`;
  if(!Array.isArray(rows[0]?.data)) return;
  const assignments=rows[0].data.map((ids: unknown)=>Array.isArray(ids) ? ids.map(Number).filter((id)=>id !== Number(personId)) : []);
  await sql`UPDATE ejc_settings SET data=${sql.json(assignments)} WHERE key='eventAssignments'`;
}
export async function GET() {
  if (!connectionString()) return NextResponse.json({people:[],teams:[],tags:[],lastEjc:18,eventAssignments:[],eventNumber:19});
  const sql=db(); try { await setup(sql); const people=await sql`SELECT data FROM ejc_people ORDER BY id`; const settings=await sql`SELECT key,data FROM ejc_settings`; const map=Object.fromEntries(settings.map(x=>[x.key,x.data])); return NextResponse.json({people:people.map(x=>x.data),teams:map.teams||[],tags:map.tags||[],lastEjc:Number(map.lastEjc)||18,eventAssignments:map.eventAssignments||[],eventNumber:Number(map.eventNumber)||0}); } finally { await sql.end(); }
}
export async function POST(req:Request) {
  if (!connectionString()) return NextResponse.json({error:"Banco não configurado"},{status:503});
  const body=await req.json(); const sql=db(); try {
    await setup(sql);
    if(body.type==="deletePerson") {
      const rows=await sql`SELECT data FROM ejc_people WHERE id=${body.id} LIMIT 1`;
      if(!rows.length) return NextResponse.json({error:"Perfil não encontrado."},{status:404});
      const person=rows[0].data as Record<string, any>;
      if(person.active !== false) return NextResponse.json({error:"Somente perfis inativos podem ser excluídos."},{status:400});
      await sql`DELETE FROM ejc_people WHERE id=${body.id}`;
      await removeFromEvent(sql,Number(body.id));
    }
    if(body.type==="personStatus") {
      const rows=await sql`SELECT data FROM ejc_people WHERE id=${body.id} LIMIT 1`;
      if(!rows.length) return NextResponse.json({error:"Perfil não encontrado."},{status:404});
      const person=rows[0].data as Record<string, any>;
      const active=body.active !== false;
      const inactiveReason=String(body.inactiveReason || "").trim();
      if(!active && !inactiveReason) return NextResponse.json({error:"Informe o motivo da inativação."},{status:400});
      const updated: Record<string, any>={...person,active};
      if(active) delete updated.inactiveReason;
      else updated.inactiveReason=inactiveReason;
      await sql`UPDATE ejc_people SET data=${sql.json(updated)} WHERE id=${body.id}`;
      if(!active) await removeFromEvent(sql,Number(body.id));
    }
    if(body.type==="person") {
      const person = body.person;
      person.main = String(person.main || "").trim().toLocaleLowerCase("pt-BR");
      person.tags = [...new Set((person.tags || []).map((tag: unknown) => String(tag).trim().toLocaleLowerCase("pt-BR")).filter(Boolean))];
      const tagSettings=await sql`SELECT data FROM ejc_settings WHERE key='tags' LIMIT 1`;
      const savedPeople=await sql`SELECT data FROM ejc_people`;
      const allowedTags=new Set<string>([
        ...(Array.isArray(tagSettings[0]?.data) ? tagSettings[0].data.map(String) : []),
        ...savedPeople.flatMap((row) => {
          const saved=row.data as Record<string, any>;
          return [...(Array.isArray(saved.tags) ? saved.tags.map(String) : []), String(saved.main || "")];
        }),
      ].map((tag) => tag.trim().toLocaleLowerCase("pt-BR")).filter(Boolean));
      const unknownTag=[person.main,...person.tags].find((tag: string) => !allowedTags.has(tag));
      if(unknownTag) return NextResponse.json({error:`A tag "${unknownTag}" não está cadastrada.`},{status:400});
      if(person.active === false) {
        person.inactiveReason = String(person.inactiveReason || "").trim();
        if(!person.inactiveReason) return NextResponse.json({error:"Informe o motivo da inativação."},{status:400});
      } else {
        delete person.inactiveReason;
      }
      const current=await sql`SELECT data->>'name' AS name FROM ejc_people WHERE id = ${person.id} LIMIT 1`;
      const nameChanged=!current.length || String(current[0].name || "").trim().toLocaleLowerCase("pt-BR") !== String(person.name || "").trim().toLocaleLowerCase("pt-BR");
      if(nameChanged) {
        const duplicate=await sql`SELECT id FROM ejc_people WHERE id <> ${person.id} AND lower(trim(data->>'name')) = lower(trim(${person.name})) LIMIT 1`;
        if(duplicate.length) return NextResponse.json({error:"Já existe uma pessoa cadastrada com esse nome."},{status:409});
      }
      if(!person.tags.length) return NextResponse.json({error:"Adicione pelo menos um ponto forte."},{status:400});
      await sql`INSERT INTO ejc_people (id,data) VALUES (${person.id},${sql.json(person)}) ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data`;
    }
    if(body.type==="teams") await sql`INSERT INTO ejc_settings (key,data) VALUES ('teams',${sql.json(body.teams)}) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data`;
    if(body.type==="tags") await sql`INSERT INTO ejc_settings (key,data) VALUES ('tags',${sql.json(body.tags)}) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data`;
    if(body.type==="lastEjc") await sql`INSERT INTO ejc_settings (key,data) VALUES ('lastEjc',${sql.json(body.lastEjc)}) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data`;
    if(body.type==="eventAssignments") {
      if(!Array.isArray(body.assignments) || body.assignments.some((ids: unknown)=>!Array.isArray(ids))) return NextResponse.json({error:"Montagem de equipes inválida."},{status:400});
      const eventNumber=Number(body.eventNumber);
      if(!Number.isSafeInteger(eventNumber) || eventNumber < 1) return NextResponse.json({error:"Número do encontro inválido."},{status:400});
      const assignments:number[][]=body.assignments.map((ids: unknown[])=>ids.map(Number));
      const allIds=assignments.flat();
      if(new Set(allIds).size !== allIds.length) return NextResponse.json({error:"O mesmo perfil não pode participar de equipes diferentes."},{status:400});
      const savedPeople=await sql`SELECT id,data FROM ejc_people`;
      const activeIds=new Set(savedPeople.filter((row)=>row.data?.active !== false).map((row)=>Number(row.id)));
      if(allIds.some((id)=>!Number.isSafeInteger(id) || !activeIds.has(id))) return NextResponse.json({error:"A montagem contém um perfil inexistente ou inativo."},{status:400});
      await sql`INSERT INTO ejc_settings (key,data) VALUES ('eventAssignments',${sql.json(assignments)}) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data`;
      await sql`INSERT INTO ejc_settings (key,data) VALUES ('eventNumber',${sql.json(eventNumber)}) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data`;
    }
    if(body.type==="deleteTag") {
      const tag=String(body.tag || "").trim().toLocaleLowerCase("pt-BR");
      const people=await sql`SELECT id,data FROM ejc_people`;
      for(const row of people) {
        const data=row.data as Record<string, any>;
        const tags=Array.isArray(data.tags) ? data.tags.map(String).filter((item) => item.trim().toLocaleLowerCase("pt-BR") !== tag) : [];
        const main=String(data.main || "").trim().toLocaleLowerCase("pt-BR") === tag ? (tags[0] || "") : String(data.main || "");
        await sql`UPDATE ejc_people SET data=${sql.json({...data,tags,main})} WHERE id=${row.id}`;
      }
      const settings=await sql`SELECT key,data FROM ejc_settings WHERE key IN ('tags','teams')`;
      for(const setting of settings) {
        if(setting.key === "tags" && Array.isArray(setting.data)) {
          const tags=setting.data.map(String).filter((item: string) => item.trim().toLocaleLowerCase("pt-BR") !== tag);
          await sql`UPDATE ejc_settings SET data=${sql.json(tags)} WHERE key='tags'`;
        }
        if(setting.key === "teams" && Array.isArray(setting.data)) {
          const teams:string[][]=setting.data.filter(Array.isArray).map((team: unknown[]) => team.map(String).filter((item, index) => index === 0 || item.trim().toLocaleLowerCase("pt-BR") !== tag));
          await sql`UPDATE ejc_settings SET data=${sql.json(teams)} WHERE key='teams'`;
        }
      }
    }
    return NextResponse.json({ok:true});
  } finally { await sql.end(); }
}
