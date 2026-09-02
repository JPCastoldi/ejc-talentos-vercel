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
export async function GET() {
  if (!connectionString()) return NextResponse.json({people:[],teams:[],tags:[],lastEjc:18});
  const sql=db(); try { await setup(sql); const people=await sql`SELECT data FROM ejc_people ORDER BY id`; const settings=await sql`SELECT key,data FROM ejc_settings`; const map=Object.fromEntries(settings.map(x=>[x.key,x.data])); return NextResponse.json({people:people.map(x=>x.data),teams:map.teams||[],tags:map.tags||[],lastEjc:Number(map.lastEjc)||18}); } finally { await sql.end(); }
}
export async function POST(req:Request) {
  if (!connectionString()) return NextResponse.json({error:"Banco não configurado"},{status:503});
  const body=await req.json(); const sql=db(); try {
    await setup(sql);
    if(body.type==="person") {
      const person = body.person;
      person.main = String(person.main || "").trim().toLocaleLowerCase("pt-BR");
      person.tags = [...new Set((person.tags || []).map((tag: unknown) => String(tag).trim().toLocaleLowerCase("pt-BR")).filter(Boolean))];
      const duplicate=await sql`SELECT id FROM ejc_people WHERE id <> ${person.id} AND lower(trim(data->>'name')) = lower(trim(${person.name})) LIMIT 1`;
      if(duplicate.length) return NextResponse.json({error:"Já existe uma pessoa cadastrada com esse nome."},{status:409});
      if(!person.history?.length || !person.tags.length) return NextResponse.json({error:"Experiências anteriores e pontos fortes são obrigatórios."},{status:400});
      await sql`INSERT INTO ejc_people (id,data) VALUES (${person.id},${sql.json(person)}) ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data`;
    }
    if(body.type==="teams") await sql`INSERT INTO ejc_settings (key,data) VALUES ('teams',${sql.json(body.teams)}) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data`;
    if(body.type==="tags") await sql`INSERT INTO ejc_settings (key,data) VALUES ('tags',${sql.json(body.tags)}) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data`;
    if(body.type==="lastEjc") await sql`INSERT INTO ejc_settings (key,data) VALUES ('lastEjc',${sql.json(body.lastEjc)}) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data`;
    return NextResponse.json({ok:true});
  } finally { await sql.end(); }
}
