import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import postgres from "postgres";
import { requestIsAdmin } from "@/lib/admin-auth";

const connectionString = () => process.env.DATABASE_URL || process.env.STORAGE_DATABASE_URL;
const db = () => postgres(connectionString()!, { ssl: "require", max: 1 });
const normalizeTag = (value: unknown) => String(value || "").trim().toLocaleLowerCase("pt-BR");
const defaultTeams = [
  ["Coordenação Geral", "liderança", "organização", "visão geral"], ["Equipe de Sala", "acolhimento", "comunicação", "empatia"],
  ["Equipe de Animação", "instrumento", "energia", "desinibição"], ["Equipe Externa", "proatividade", "agilidade", "trabalho em equipe"],
  ["Mini Mercado", "organização", "atendimento", "responsabilidade"], ["Equipe de Compras", "planejamento", "negociação", "responsabilidade"],
  ["Garçom e Cafezinho", "simpatia", "agilidade", "serviço"], ["Equipe de Círculo", "comunicação", "criatividade", "acolhimento"],
  ["Equipe de Cozinha", "culinária", "organização", "trabalho em equipe"], ["Equipe de Secretaria", "escrita", "organização", "atenção"],
  ["Equipe de Liturgia", "espiritualidade", "oratória", "instrumento"], ["Equipe de Música", "instrumento", "canto", "trabalho em equipe"],
  ["Ordem e Limpeza", "disciplina", "proatividade", "organização"],
];

async function createSchema(sql: ReturnType<typeof postgres>) {
  await sql`CREATE TABLE IF NOT EXISTS ejc_people (id BIGINT PRIMARY KEY, data JSONB NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ejc_settings (key TEXT PRIMARY KEY, data JSONB NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ejc_migrations (name TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS ejc_tags (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ejc_tags_name_unique ON ejc_tags (LOWER(TRIM(name)))`;
  await sql`CREATE TABLE IF NOT EXISTS ejc_profiles (id BIGINT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL CHECK (kind IN ('jovem','tios')),community TEXT NOT NULL,main_tag_id BIGINT REFERENCES ejc_tags(id) ON DELETE SET NULL,current_activity TEXT NOT NULL DEFAULT '',birth_year INTEGER,active BOOLEAN NOT NULL DEFAULT TRUE,inactive_reason TEXT,served_last_ejc BOOLEAN NOT NULL DEFAULT FALSE,note TEXT NOT NULL DEFAULT '',photo_url TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CHECK (active OR NULLIF(TRIM(inactive_reason),'') IS NOT NULL))`;
  await sql`CREATE INDEX IF NOT EXISTS ejc_profiles_name_idx ON ejc_profiles (LOWER(TRIM(name)))`;
  await sql`CREATE INDEX IF NOT EXISTS ejc_profiles_active_kind_idx ON ejc_profiles (active,kind)`;
  await sql`CREATE TABLE IF NOT EXISTS ejc_profile_tags (profile_id BIGINT NOT NULL REFERENCES ejc_profiles(id) ON DELETE CASCADE,tag_id BIGINT NOT NULL REFERENCES ejc_tags(id) ON DELETE CASCADE,PRIMARY KEY (profile_id,tag_id))`;
  await sql`CREATE INDEX IF NOT EXISTS ejc_profile_tags_tag_idx ON ejc_profile_tags(tag_id)`;
  await sql`CREATE TABLE IF NOT EXISTS ejc_experiences (id BIGSERIAL PRIMARY KEY,profile_id BIGINT NOT NULL REFERENCES ejc_profiles(id) ON DELETE CASCADE,description TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0)`;
  await sql`CREATE INDEX IF NOT EXISTS ejc_experiences_profile_idx ON ejc_experiences(profile_id,sort_order)`;
  await sql`CREATE TABLE IF NOT EXISTS ejc_teams (id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,sort_order INTEGER NOT NULL UNIQUE)`;
  await sql`CREATE TABLE IF NOT EXISTS ejc_team_tags (team_id BIGINT NOT NULL REFERENCES ejc_teams(id) ON DELETE CASCADE,tag_id BIGINT NOT NULL REFERENCES ejc_tags(id) ON DELETE CASCADE,sort_order INTEGER NOT NULL DEFAULT 0,PRIMARY KEY (team_id,tag_id))`;
  await sql`CREATE TABLE IF NOT EXISTS ejc_encounters (id BIGSERIAL PRIMARY KEY,number INTEGER NOT NULL UNIQUE CHECK (number > 0),status TEXT NOT NULL CHECK (status IN ('planning','completed','archived')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ejc_one_planning_encounter ON ejc_encounters(status) WHERE status='planning'`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ejc_one_completed_encounter ON ejc_encounters(status) WHERE status='completed'`;
  await sql`CREATE TABLE IF NOT EXISTS ejc_team_assignments (encounter_id BIGINT NOT NULL REFERENCES ejc_encounters(id) ON DELETE CASCADE,team_id BIGINT NOT NULL REFERENCES ejc_teams(id) ON DELETE CASCADE,profile_id BIGINT NOT NULL REFERENCES ejc_profiles(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY (encounter_id,team_id,profile_id),UNIQUE (encounter_id,profile_id))`;
}

async function tagId(sql: ReturnType<typeof postgres>, name: unknown) {
  const normalized=normalizeTag(name); if(!normalized) return null;
  const rows=await sql`INSERT INTO ejc_tags(name) VALUES (${normalized}) ON CONFLICT ((LOWER(TRIM(name)))) DO UPDATE SET name=EXCLUDED.name RETURNING id`;
  return Number(rows[0].id);
}

async function migrateLegacy(sql: ReturnType<typeof postgres>) {
  if((await sql`SELECT 1 FROM ejc_migrations WHERE name='normalize-v1'`).length) return;
  const settings=Object.fromEntries((await sql`SELECT key,data FROM ejc_settings`).map((row)=>[row.key,row.data]));
  const legacyPeople=await sql`SELECT id,data FROM ejc_people ORDER BY id`;
  const teams:Array<unknown[]>=Array.isArray(settings.teams) && settings.teams.length ? settings.teams : defaultTeams;
  const knownTags=new Set<string>();
  if(Array.isArray(settings.tags)) settings.tags.forEach((tag: unknown)=>knownTags.add(normalizeTag(tag)));
  legacyPeople.forEach((row)=>{const person=row.data as Record<string,any>;knownTags.add(normalizeTag(person.main));if(Array.isArray(person.tags))person.tags.forEach((tag: unknown)=>knownTags.add(normalizeTag(tag)));});
  teams.forEach((team)=>team.slice(1).forEach((tag)=>knownTags.add(normalizeTag(tag))));
  for(const tag of knownTags) if(tag) await tagId(sql,tag);
  for(const row of legacyPeople) {
    const person=row.data as Record<string,any>; const mainTagId=await tagId(sql,person.main); const active=person.active !== false; const reason=active ? null : String(person.inactiveReason || "Motivo não informado");
    await sql`INSERT INTO ejc_profiles(id,name,kind,community,main_tag_id,current_activity,birth_year,active,inactive_reason,served_last_ejc,note,photo_url) VALUES (${Number(row.id)},${String(person.name || "Sem nome")},${person.kind === "tios" ? "tios" : "jovem"},${String(person.community || "")},${mainTagId},${String(person.current || "")},${Number(person.birthYear) || null},${active},${reason},${person.servedLastEjc === true},${String(person.note || "")},${person.photo ? String(person.photo) : null}) ON CONFLICT(id) DO NOTHING`;
    for(const tag of Array.isArray(person.tags) ? person.tags : []) {const id=await tagId(sql,tag);if(id)await sql`INSERT INTO ejc_profile_tags(profile_id,tag_id) VALUES (${Number(row.id)},${id}) ON CONFLICT DO NOTHING`;}
    const history=Array.isArray(person.history) ? person.history : person.history ? [person.history] : [];
    for(let index=0;index<history.length;index++) await sql`INSERT INTO ejc_experiences(profile_id,description,sort_order) SELECT ${Number(row.id)},${String(history[index])},${index} WHERE NOT EXISTS (SELECT 1 FROM ejc_experiences WHERE profile_id=${Number(row.id)} AND description=${String(history[index])})`;
  }
  for(let index=0;index<teams.length;index++) {
    const team=teams[index].map(String); const rows=await sql`INSERT INTO ejc_teams(name,sort_order) VALUES (${team[0]},${index}) ON CONFLICT(sort_order) DO UPDATE SET name=EXCLUDED.name RETURNING id`; const teamId=Number(rows[0].id);
    for(let tagIndex=1;tagIndex<team.length;tagIndex++){const id=await tagId(sql,team[tagIndex]);if(id)await sql`INSERT INTO ejc_team_tags(team_id,tag_id,sort_order) VALUES (${teamId},${id},${tagIndex-1}) ON CONFLICT(team_id,tag_id) DO UPDATE SET sort_order=EXCLUDED.sort_order`;}
  }
  const lastEjc=Number(settings.lastEjc)||18;
  await sql`INSERT INTO ejc_encounters(number,status) VALUES (${lastEjc},'completed') ON CONFLICT(number) DO UPDATE SET status='completed'`;
  const eventNumber=Number(settings.eventNumber)||lastEjc+1;
  const eventRows=await sql`INSERT INTO ejc_encounters(number,status) VALUES (${eventNumber},'planning') ON CONFLICT(number) DO UPDATE SET status='planning' RETURNING id`;
  if(Array.isArray(settings.eventAssignments)) {
    const teamRows=await sql`SELECT id,sort_order FROM ejc_teams`; const teamByOrder=new Map(teamRows.map((row)=>[Number(row.sort_order),Number(row.id)]));
    for(let teamIndex=0;teamIndex<settings.eventAssignments.length;teamIndex++){const teamId=teamByOrder.get(teamIndex);const ids=settings.eventAssignments[teamIndex];if(!teamId||!Array.isArray(ids))continue;for(const profileId of ids.map(Number))await sql`INSERT INTO ejc_team_assignments(encounter_id,team_id,profile_id) SELECT ${Number(eventRows[0].id)},${teamId},${profileId} WHERE EXISTS (SELECT 1 FROM ejc_profiles WHERE id=${profileId} AND active) ON CONFLICT DO NOTHING`;}
  }
  await sql`INSERT INTO ejc_migrations(name) VALUES ('normalize-v1') ON CONFLICT DO NOTHING`;
}

async function migrateInlinePhotos(sql: ReturnType<typeof postgres>) {
  if(!process.env.BLOB_READ_WRITE_TOKEN) return;
  const rows=await sql`SELECT id,photo_url FROM ejc_profiles WHERE photo_url LIKE 'data:image/%;base64,%'`;
  for(const row of rows){const match=String(row.photo_url).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);if(!match)continue;try{const extension=match[1].split("/")[1].replace("jpeg","jpg");const blob=await put(`perfis/migrado-${row.id}.${extension}`,Buffer.from(match[2],"base64"),{access:"public",addRandomSuffix:true,contentType:match[1]});await sql`UPDATE ejc_profiles SET photo_url=${blob.url},updated_at=NOW() WHERE id=${row.id}`;}catch{continue;}}
}
async function setup(sql: ReturnType<typeof postgres>){await createSchema(sql);await migrateLegacy(sql);await migrateInlinePhotos(sql);}

async function readData(sql: ReturnType<typeof postgres>) {
  const profiles=await sql`SELECT p.*,mt.name AS main FROM ejc_profiles p LEFT JOIN ejc_tags mt ON mt.id=p.main_tag_id ORDER BY p.name`;
  const profileTags=await sql`SELECT pt.profile_id,t.name FROM ejc_profile_tags pt JOIN ejc_tags t ON t.id=pt.tag_id ORDER BY t.name`;
  const experiences=await sql`SELECT profile_id,description FROM ejc_experiences ORDER BY profile_id,sort_order,id`;
  const tagsByProfile=new Map<number,string[]>(); profileTags.forEach((row)=>tagsByProfile.set(Number(row.profile_id),[...(tagsByProfile.get(Number(row.profile_id))||[]),String(row.name)]));
  const historyByProfile=new Map<number,string[]>(); experiences.forEach((row)=>historyByProfile.set(Number(row.profile_id),[...(historyByProfile.get(Number(row.profile_id))||[]),String(row.description)]));
  const people=profiles.map((row)=>({id:Number(row.id),name:row.name,kind:row.kind,community:row.community,main:row.main||"",tags:tagsByProfile.get(Number(row.id))||[],current:row.current_activity,history:historyByProfile.get(Number(row.id))||[],birthYear:row.birth_year||undefined,active:row.active,inactiveReason:row.inactive_reason||undefined,servedLastEjc:row.served_last_ejc,note:row.note,photo:row.photo_url||undefined}));
  const teamRows=await sql`SELECT id,name,sort_order FROM ejc_teams ORDER BY sort_order`;
  const teamTags=await sql`SELECT tt.team_id,t.name FROM ejc_team_tags tt JOIN ejc_tags t ON t.id=tt.tag_id ORDER BY tt.team_id,tt.sort_order`;
  const tagsByTeam=new Map<number,string[]>();teamTags.forEach((row)=>tagsByTeam.set(Number(row.team_id),[...(tagsByTeam.get(Number(row.team_id))||[]),String(row.name)]));
  const teams=teamRows.map((row)=>[String(row.name),...(tagsByTeam.get(Number(row.id))||[])]);
  const completed=await sql`SELECT number FROM ejc_encounters WHERE status='completed' LIMIT 1`;const lastEjc=Number(completed[0]?.number)||18;
  const planning=await sql`SELECT id,number FROM ejc_encounters WHERE status='planning' LIMIT 1`;const eventNumber=Number(planning[0]?.number)||lastEjc+1;
  const assignments=teamRows.map(()=>[] as number[]);
  if(planning.length){const teamIndex=new Map(teamRows.map((row,index)=>[Number(row.id),index]));const rows=await sql`SELECT team_id,profile_id FROM ejc_team_assignments WHERE encounter_id=${Number(planning[0].id)}`;rows.forEach((row)=>{const index=teamIndex.get(Number(row.team_id));if(index!==undefined)assignments[index].push(Number(row.profile_id));});}
  const allTags=(await sql`SELECT name FROM ejc_tags ORDER BY name`).map((row)=>String(row.name));
  return {people,teams,tags:allTags,lastEjc,eventAssignments:assignments,eventNumber};
}

async function deleteBlob(url: unknown){const value=String(url||"");if(!value.includes("blob.vercel-storage.com")||!process.env.BLOB_READ_WRITE_TOKEN)return;await del(value).catch(()=>{});}

export async function GET(){if(!connectionString())return NextResponse.json({people:[],teams:[],tags:[],lastEjc:18,eventAssignments:[],eventNumber:19});const sql=db();try{await setup(sql);return NextResponse.json(await readData(sql));}finally{await sql.end();}}

export async function POST(req: Request) {
  if(!requestIsAdmin(req))return NextResponse.json({error:"Entre com a senha administrativa para fazer alterações."},{status:401});
  if(!connectionString())return NextResponse.json({error:"Banco não configurado"},{status:503});
  const body=await req.json();const sql=db();
  try {
    await setup(sql);
    if(body.type==="person"){
      const person=body.person as Record<string,any>;const id=Number(person.id);const name=String(person.name||"").trim();const kind=person.kind==="tios"?"tios":"jovem";const main=normalizeTag(person.main);const tags=[...new Set((Array.isArray(person.tags)?person.tags:[]).map(normalizeTag).filter(Boolean))];
      if(!Number.isSafeInteger(id)||!name)return NextResponse.json({error:"Perfil inválido."},{status:400});
      if(!tags.length)return NextResponse.json({error:"Adicione pelo menos um ponto forte."},{status:400});
      if((await sql`SELECT id FROM ejc_profiles WHERE id<>${id} AND LOWER(TRIM(name))=LOWER(TRIM(${name})) LIMIT 1`).length)return NextResponse.json({error:"Já existe uma pessoa cadastrada com esse nome."},{status:409});
      const tagRows=await sql`SELECT id,name FROM ejc_tags WHERE LOWER(TRIM(name)) IN ${sql(tags)}`;const tagMap=new Map(tagRows.map((row)=>[normalizeTag(row.name),Number(row.id)]));const mainRows=await sql`SELECT id FROM ejc_tags WHERE LOWER(TRIM(name))=${main} LIMIT 1`;
      if(tagMap.size!==tags.length||!mainRows.length)return NextResponse.json({error:"Selecione somente tags cadastradas."},{status:400});
      const active=person.active!==false;const reason=active?null:String(person.inactiveReason||"").trim();if(!active&&!reason)return NextResponse.json({error:"Informe o motivo da inativação."},{status:400});
      const old=await sql`SELECT photo_url FROM ejc_profiles WHERE id=${id}`;
      await sql.begin(async(tx)=>{await tx`INSERT INTO ejc_profiles(id,name,kind,community,main_tag_id,current_activity,birth_year,active,inactive_reason,served_last_ejc,note,photo_url,updated_at) VALUES (${id},${name},${kind},${String(person.community||"")},${Number(mainRows[0].id)},${String(person.current||"")},${Number(person.birthYear)||null},${active},${reason},${person.servedLastEjc===true},${String(person.note||"")},${person.photo?String(person.photo):null},NOW()) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,kind=EXCLUDED.kind,community=EXCLUDED.community,main_tag_id=EXCLUDED.main_tag_id,current_activity=EXCLUDED.current_activity,birth_year=EXCLUDED.birth_year,active=EXCLUDED.active,inactive_reason=EXCLUDED.inactive_reason,served_last_ejc=EXCLUDED.served_last_ejc,note=EXCLUDED.note,photo_url=EXCLUDED.photo_url,updated_at=NOW()`;await tx`DELETE FROM ejc_profile_tags WHERE profile_id=${id}`;for(const tag of tags)await tx`INSERT INTO ejc_profile_tags(profile_id,tag_id) VALUES (${id},${tagMap.get(tag)!})`;await tx`DELETE FROM ejc_experiences WHERE profile_id=${id}`;const history=Array.isArray(person.history)?person.history.map(String).map((value)=>value.trim()).filter(Boolean):[];for(let index=0;index<history.length;index++)await tx`INSERT INTO ejc_experiences(profile_id,description,sort_order) VALUES (${id},${history[index]},${index})`;});
      if(old[0]?.photo_url&&old[0].photo_url!==person.photo)await deleteBlob(old[0].photo_url);
    }
    if(body.type==="personStatus") {const id=Number(body.id);const active=body.active!==false;const reason=active?null:String(body.inactiveReason||"").trim();if(!active&&!reason)return NextResponse.json({error:"Informe o motivo da inativação."},{status:400});const updated=await sql`UPDATE ejc_profiles SET active=${active},inactive_reason=${reason},updated_at=NOW() WHERE id=${id} RETURNING id`;if(!updated.length)return NextResponse.json({error:"Perfil não encontrado."},{status:404});if(!active)await sql`DELETE FROM ejc_team_assignments a USING ejc_encounters e WHERE a.encounter_id=e.id AND e.status='planning' AND a.profile_id=${id}`;}
    if(body.type==="deletePerson") {const id=Number(body.id);const rows=await sql`SELECT active,photo_url FROM ejc_profiles WHERE id=${id}`;if(!rows.length)return NextResponse.json({error:"Perfil não encontrado."},{status:404});if(rows[0].active!==false)return NextResponse.json({error:"Somente perfis inativos podem ser excluídos."},{status:400});await sql`DELETE FROM ejc_profiles WHERE id=${id}`;await deleteBlob(rows[0].photo_url);}
    if(body.type==="tags")for(const tag of Array.isArray(body.tags)?body.tags:[])await tagId(sql,tag);
    if(body.type==="deleteTag") {const name=normalizeTag(body.tag);const rows=await sql`SELECT id FROM ejc_tags WHERE LOWER(TRIM(name))=${name}`;if(rows.length){const id=Number(rows[0].id);const blocked=await sql`SELECT pt.profile_id FROM ejc_profile_tags pt WHERE pt.tag_id=${id} AND (SELECT COUNT(*) FROM ejc_profile_tags all_pt WHERE all_pt.profile_id=pt.profile_id)<=1 LIMIT 1`;if(blocked.length)return NextResponse.json({error:"Esta tag é o único ponto forte de um perfil e não pode ser excluída."},{status:409});await sql`UPDATE ejc_profiles p SET main_tag_id=(SELECT pt.tag_id FROM ejc_profile_tags pt WHERE pt.profile_id=p.id AND pt.tag_id<>${id} LIMIT 1) WHERE p.main_tag_id=${id}`;await sql`DELETE FROM ejc_tags WHERE id=${id}`;}}
    if(body.type==="teams") {const teams:Array<unknown[]>=Array.isArray(body.teams)?body.teams:[];for(let index=0;index<teams.length;index++){const team=teams[index].map(String);const rows=await sql`INSERT INTO ejc_teams(name,sort_order) VALUES (${team[0]},${index}) ON CONFLICT(sort_order) DO UPDATE SET name=EXCLUDED.name RETURNING id`;const teamId=Number(rows[0].id);await sql`DELETE FROM ejc_team_tags WHERE team_id=${teamId}`;for(let tagIndex=1;tagIndex<team.length;tagIndex++){const id=await tagId(sql,team[tagIndex]);if(id)await sql`INSERT INTO ejc_team_tags(team_id,tag_id,sort_order) VALUES (${teamId},${id},${tagIndex-1}) ON CONFLICT DO NOTHING`;}}}
    if(body.type==="lastEjc") {const number=Number(body.lastEjc);if(!Number.isSafeInteger(number)||number<1)return NextResponse.json({error:"Número do EJC inválido."},{status:400});await sql.begin(async(tx)=>{await tx`UPDATE ejc_encounters SET status='archived' WHERE status IN ('completed','planning')`;await tx`INSERT INTO ejc_encounters(number,status) VALUES (${number},'completed') ON CONFLICT(number) DO UPDATE SET status='completed'`;await tx`INSERT INTO ejc_encounters(number,status) VALUES (${number+1},'planning') ON CONFLICT(number) DO UPDATE SET status='planning'`;});}
    if(body.type==="eventAssignments") {const number=Number(body.eventNumber);const assignments:number[][]=Array.isArray(body.assignments)&&body.assignments.every(Array.isArray)?body.assignments.map((ids:unknown[])=>ids.map(Number)):[];const allIds=assignments.flat();if(!Number.isSafeInteger(number)||new Set(allIds).size!==allIds.length)return NextResponse.json({error:"O mesmo perfil não pode participar de equipes diferentes."},{status:400});const encounter=await sql`SELECT id FROM ejc_encounters WHERE number=${number} AND status='planning'`;if(!encounter.length)return NextResponse.json({error:"Encontro em planejamento não encontrado."},{status:404});const profiles=allIds.length?await sql`SELECT id FROM ejc_profiles WHERE active AND id IN ${sql(allIds)}`:[];if(profiles.length!==allIds.length)return NextResponse.json({error:"A montagem contém um perfil inexistente ou inativo."},{status:400});const teams=await sql`SELECT id,sort_order FROM ejc_teams ORDER BY sort_order`;await sql.begin(async(tx)=>{await tx`DELETE FROM ejc_team_assignments WHERE encounter_id=${Number(encounter[0].id)}`;for(let index=0;index<assignments.length;index++){const team=teams.find((row)=>Number(row.sort_order)===index);if(!team)continue;for(const profileId of assignments[index])await tx`INSERT INTO ejc_team_assignments(encounter_id,team_id,profile_id) VALUES (${Number(encounter[0].id)},${Number(team.id)},${profileId})`;}});}
    return NextResponse.json({ok:true});
  } catch(error) {const message=error instanceof Error?error.message:"Erro interno";return NextResponse.json({error:message.includes("ejc_profiles_name_unique")?"Já existe uma pessoa cadastrada com esse nome.":"Não foi possível concluir a operação."},{status:500});}
  finally {await sql.end();}
}
