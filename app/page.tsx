"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Camera,
  ChevronRight,
  CircleUserRound,
  LayoutGrid,
  Pencil,
  Plus,
  Search,
  Tags,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Kind = "jovem" | "tios";
type Person = {
  id: number;
  name: string;
  kind: Kind;
  community: string;
  main: string;
  tags: string[];
  current: string;
  history: string;
  note: string;
  photo?: string;
};
const defaultTeams = [
  ["Coordenação Geral", "Liderança", "Organização", "Visão geral"],
  ["Equipe de Sala", "Acolhimento", "Comunicação", "Empatia"],
  ["Equipe de Animação", "Instrumento", "Energia", "Desinibição"],
  ["Equipe Externa", "Proatividade", "Agilidade", "Trabalho em equipe"],
  ["Mini Mercado", "Organização", "Atendimento", "Responsabilidade"],
  ["Equipe de Compras", "Planejamento", "Negociação", "Responsabilidade"],
  ["Garçom e Cafezinho", "Simpatia", "Agilidade", "Serviço"],
  ["Equipe de Círculo", "Comunicação", "Criatividade", "Acolhimento"],
  ["Equipe de Cozinha", "Culinária", "Organização", "Trabalho em equipe"],
  ["Equipe de Secretaria", "Escrita", "Organização", "Atenção"],
  ["Equipe de Liturgia", "Espiritualidade", "Oratória", "Instrumento"],
  ["Equipe de Música", "Instrumento", "Canto", "Trabalho em equipe"],
  ["Ordem e Limpeza", "Disciplina", "Proatividade", "Organização"],
];
const initial: Person[] = [
  {
    id: 1,
    name: "Marina Alves",
    kind: "jovem",
    community: "São Paulo Apóstolo",
    main: "Comunicação",
    tags: ["Comunicação", "Acolhimento", "Criatividade"],
    current: "Grupo de Jovens",
    history: "Círculo — 18º EJC",
    note: "Tem facilidade para conduzir dinâmicas e integrar jovens mais tímidos.",
  },
  {
    id: 2,
    name: "Lucas Martins",
    kind: "jovem",
    community: "Nossa Senhora da Penha",
    main: "Instrumento",
    tags: ["Instrumento", "Espiritualidade", "Proatividade"],
    current: "Ministério de Música",
    history: "Liturgia — 17º EJC",
    note: "Toca violão e teclado; mantém tranquilidade nos momentos de oração.",
  },
  {
    id: 3,
    name: "Ana Clara Souza",
    kind: "jovem",
    community: "Sagrada Família",
    main: "Organização",
    tags: ["Organização", "Escrita", "Atenção"],
    current: "Pastoral da Comunicação",
    history: "Secretaria — 18º EJC",
    note: "Muito atenta a prazos, listas e detalhes.",
  },
  {
    id: 4,
    name: "Rafael Costa",
    kind: "jovem",
    community: "São José",
    main: "Proatividade",
    tags: ["Proatividade", "Agilidade", "Trabalho em equipe"],
    current: "Coroinhas",
    history: "Externa — 17º EJC",
    note: "Resolve imprevistos com rapidez e trabalha bem sob pressão.",
  },
  {
    id: 5,
    name: "Carlos e Beatriz",
    kind: "tios",
    community: "Nossa Senhora da Penha",
    main: "Acolhimento",
    tags: ["Acolhimento", "Liderança", "Empatia"],
    current: "Pastoral Familiar",
    history: "Sala — 16º e 18º EJC",
    note: "Casal acolhedor, sereno e com boa escuta.",
  },
  {
    id: 6,
    name: "Paulo e Renata",
    kind: "tios",
    community: "São Paulo Apóstolo",
    main: "Liderança",
    tags: ["Liderança", "Organização", "Responsabilidade"],
    current: "ECC",
    history: "Coordenação — 17º EJC",
    note: "Experiência em planejamento e acompanhamento de equipes.",
  },
];
const colors = [
  "#f47a20",
  "#111111",
  "#d65f0f",
  "#78320c",
  "#ff9a4d",
  "#2d2d2d",
];

export default function Home() {
  const [view, setView] = useState("inicio"),
    [people, setPeople] = useState<Person[]>(initial),
    [teamList, setTeamList] = useState<string[][]>(defaultTeams),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Person | null>(null),
    [editing, setEditing] = useState<Person | null>(null),
    [editingTeam, setEditingTeam] = useState<{
      team: string[];
      index: number;
    } | null>(null),
    [adding, setAdding] = useState(false),
    [customTags, setCustomTags] = useState<string[]>([]),
    [newTag, setNewTag] = useState("");
  useEffect(() => {
    fetch("/api/data").then(r=>r.ok?r.json():Promise.reject()).then(data=>{
      if(data.people?.length)setPeople(data.people);
      if(data.teams?.length)setTeamList(data.teams);
      if(data.tags?.length)setCustomTags(data.tags);
    }).catch(()=>{});
  }, []);
  const tags = useMemo(
    () =>
      Array.from(
        new Set([...people.flatMap((p) => p.tags), ...customTags]),
      ).sort(),
    [people, customTags],
  );
  const list = people.filter(
    (p) =>
      (view === "jovens"
        ? p.kind === "jovem"
        : view === "tios"
          ? p.kind === "tios"
          : true) &&
      `${p.name} ${p.community} ${p.tags}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function save(fd: FormData, original?: Person) {
    const file = fd.get("photo") as File;
    let photo = original?.photo;
    if (file?.size) { const upload=new FormData(); upload.set("file",file); const res=await fetch("/api/upload",{method:"POST",body:upload}); if(!res.ok) throw new Error("Falha ao enviar foto"); photo=(await res.json()).url; }
    const p: Person = {
      id: original?.id ?? Date.now(),
      name: String(fd.get("name")),
      kind: String(fd.get("kind")) as Kind,
      community: String(fd.get("community")),
      main: String(fd.get("main")),
      tags: String(fd.get("tags") || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      current: String(fd.get("current") || ""),
      history: String(fd.get("history") || ""),
      note: String(fd.get("note") || ""),
      photo,
    };
    const next = original
      ? people.map((x) => (x.id === original.id ? p : x))
      : [...people, p];
    setPeople(next);
    await fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"person",person:p})});
    setAdding(false);
    setEditing(null);
    setSelected(null);
    setView(p.kind === "jovem" ? "jovens" : "tios");
  }
  function saveTeam(fd: FormData) {
    if (!editingTeam) return;
    const updated = [
      String(fd.get("name")),
      ...String(fd.get("skills") || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ];
    const next = teamList.map((t, i) =>
      i === editingTeam.index ? updated : t,
    );
    setTeamList(next);
    fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"teams",teams:next})});
    setEditingTeam(null);
  }
  return (
    <div className="min-h-screen bg-[#fff8f2] text-[#17120f]">
      <header className="sticky top-0 z-20 border-b border-[#ead9cc] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3 lg:px-10">
          <button
            onClick={() => setView("inicio")}
            className="flex items-center gap-3 text-left"
          >
            <img
              src="/ejc-logo.png"
              alt="Símbolo do EJC"
              className="size-12 rounded-full object-contain"
            />
            <span>
              <b className="block font-serif text-xl leading-none">
                EJC Talentos
              </b>
              <small className="text-[#75675d]">
                Pessoas certas, equipes mais fortes
              </small>
            </span>
          </button>
          <Button
            onClick={() => setAdding(true)}
            className="rounded-full bg-[#f47a20] px-5 text-black hover:bg-[#df6813]"
          >
            <Plus /> Novo perfil
          </Button>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[230px_1fr]">
        <aside className="border-b border-[#d8d4c8] p-4 lg:min-h-[calc(100vh-73px)] lg:border-b-0 lg:border-r lg:p-6">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col">
            {[
              ["inicio", LayoutGrid, "Visão geral"],
              ["jovens", CircleUserRound, "Jovens"],
              ["tios", UsersRound, "Casais de tios"],
              ["equipes", BookOpen, "Equipes"],
              ["tags", Tags, "Tags e talentos"],
            ].map(([id, Icon, label]) => (
              <button
                key={id as string}
                onClick={() => setView(id as string)}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${view === id ? "bg-[#ffe5d2] text-[#bd4e08]" : "text-[#675b54] hover:bg-white/70"}`}
              >
                <Icon size={18} />
                {label as string}
              </button>
            ))}
          </nav>
          <div className="mt-8 hidden rounded-2xl bg-[#111] p-5 text-white lg:block">
            <p className="text-xs font-bold uppercase tracking-widest text-[#ff9a4d]">
              Próximo encontro
            </p>
            <p className="mt-2 font-serif text-2xl">19º EJC</p>
            <p className="mt-1 text-sm text-white/65">Base em preparação</p>
          </div>
        </aside>
        <main className="min-w-0 p-5 lg:p-10">
          {view === "inicio" && (
            <Dashboard
              people={people}
              teamCount={teamList.length}
              go={setView}
              open={setSelected}
            />
          )}{" "}
          {(view === "jovens" || view === "tios") && (
            <Directory
              title={view === "jovens" ? "Jovens" : "Casais de tios"}
              subtitle={
                view === "jovens"
                  ? "Talentos, experiências e possibilidades de cada jovem."
                  : "Experiências e dons dos casais que servem ao encontro."
              }
              people={list}
              query={query}
              setQuery={setQuery}
              open={setSelected}
              add={() => setAdding(true)}
            />
          )}{" "}
          {view === "equipes" && (
            <Teams
              people={people}
              teams={teamList}
              edit={(team, index) => setEditingTeam({ team, index })}
            />
          )}{" "}
          {view === "tags" && (
            <TagsPage
              tags={tags}
              value={newTag}
              setValue={setNewTag}
              add={() => {
                if (!newTag.trim()) return;
                const n = [...customTags, newTag.trim()];
                setCustomTags(n);
                fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"tags",tags:n})});
                setNewTag("");
              }}
            />
          )}
        </main>
      </div>
      <Profile
        person={selected}
        teams={teamList}
        close={() => setSelected(null)}
        edit={() => {
          setEditing(selected);
          setSelected(null);
        }}
      />
      <Add
        open={adding || !!editing}
        person={editing}
        close={() => {
          setAdding(false);
          setEditing(null);
        }}
        save={save}
        tags={tags}
      />
      <TeamEdit
        data={editingTeam}
        close={() => setEditingTeam(null)}
        save={saveTeam}
      />
    </div>
  );
}

function Dashboard({
  people,
  teamCount,
  go,
  open,
}: {
  people: Person[];
  teamCount: number;
  go: (x: string) => void;
  open: (p: Person) => void;
}) {
  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] bg-[#111] px-7 py-9 text-white md:px-10">
        <div className="absolute -right-20 -top-24 size-72 rounded-full border-[45px] border-[#f47a20]/30" />
        <img src="/ejc-logo.png" alt="" className="absolute bottom-0 right-8 hidden h-[92%] opacity-20 md:block" />
        <div className="relative max-w-2xl">
          <span className="text-sm font-bold uppercase tracking-[.2em] text-[#ff9a4d]">
            Banco de talentos do encontro
          </span>
          <h1 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">
            Cada dom encontra seu lugar de servir.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/75">
            Conheça as pessoas, valorize suas experiências e forme equipes mais
            equilibradas para o próximo EJC.
          </p>
        </div>
      </section>
      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          n={people.filter((p) => p.kind === "jovem").length}
          text="jovens cadastrados"
          c={colors[0]}
        />
        <Stat
          n={people.filter((p) => p.kind === "tios").length}
          text="casais de tios"
          c={colors[1]}
        />
        <Stat n={teamCount} text="equipes mapeadas" c={colors[2]} />
        <Stat
          n={new Set(people.flatMap((p) => p.tags)).size}
          text="talentos identificados"
          c={colors[4]}
        />
      </section>
      <section className="mt-8">
        <p className="eyebrow">Pessoas em destaque</p>
        <h2 className="section-title">Talentos que fazem a diferença</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {people.slice(0, 3).map((p, i) => (
            <Card key={p.id} p={p} i={i} open={() => open(p)} />
          ))}
        </div>
      </section>
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          [
            "Jovens",
            "Explore habilidades e experiências",
            "jovens",
            CircleUserRound,
          ],
          [
            "Casais de tios",
            "Consulte dons e atuações anteriores",
            "tios",
            UsersRound,
          ],
          [
            "Equipes",
            "Veja o perfil ideal de cada equipe",
            "equipes",
            BookOpen,
          ],
        ].map(([a, b, id, Icon], i) => (
          <button
            key={id as string}
            onClick={() => go(id as string)}
            className="group flex items-center gap-4 rounded-2xl border border-[#dedacf] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span
              style={{ background: colors[i] + "18", color: colors[i] }}
              className="grid size-12 shrink-0 place-items-center rounded-xl"
            >
              <Icon />
            </span>
            <span>
              <b className="block font-serif text-lg">{a as string}</b>
              <small className="text-[#6c7774]">{b as string}</small>
            </span>
            <ChevronRight className="ml-auto" />
          </button>
        ))}
      </section>
    </>
  );
}
function Stat({ n, text, c }: { n: number; text: string; c: string }) {
  return (
    <div className="rounded-2xl border border-[#dedacf] bg-white p-5 shadow-sm">
      <span style={{ color: c }} className="font-serif text-4xl font-bold">
        {String(n).padStart(2, "0")}
      </span>
      <p className="mt-1 text-sm text-[#697572]">{text}</p>
    </div>
  );
}
function Directory({
  title,
  subtitle,
  people,
  query,
  setQuery,
  open,
  add,
}: any) {
  return (
    <>
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="eyebrow">Base de pessoas</p>
          <h1 className="page-title">{title}</h1>
          <p className="mt-2 text-[#687572]">{subtitle}</p>
        </div>
        <Button onClick={add} className="rounded-full bg-[#f47a20] text-black hover:bg-[#df6813]">
          <Plus /> Adicionar perfil
        </Button>
      </div>
      <div className="relative mt-7">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#87918e]"
          size={19}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, comunidade ou talento..."
          className="h-12 w-full rounded-xl border border-[#d7d3c9] bg-white pl-12 pr-4 outline-none focus:border-[#f47a20]"
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {people.map((p: Person, i: number) => (
          <Card key={p.id} p={p} i={i} open={() => open(p)} />
        ))}
      </div>
      {!people.length && (
        <div className="mt-12 rounded-2xl border border-dashed p-12 text-center">
          Nenhum perfil encontrado.
        </div>
      )}
    </>
  );
}
function Card({ p, i, open }: { p: Person; i: number; open: () => void }) {
  return (
    <button
      onClick={open}
      className="group overflow-hidden rounded-2xl border border-[#dedacf] bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div
        className="h-1.5"
        style={{ background: colors[i % colors.length] }}
      />
      <div className="p-5">
        <div className="flex items-start gap-4">
          <Avatar name={p.name} photo={p.photo} c={colors[i % colors.length]} />
          <div className="min-w-0">
            <h3 className="truncate font-serif text-xl font-bold">{p.name}</h3>
            <p className="truncate text-sm text-[#73807c]">{p.community}</p>
          </div>
        </div>
        <div className="mt-5">
          <span className="rounded-full bg-[#fff0e4] px-3 py-1 text-xs font-bold text-[#c9580d]">
            ★ {p.main}
          </span>
        </div>
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-[#65716e]">
          {p.note}
        </p>
        <div className="mt-5 flex justify-between border-t border-[#eeeae1] pt-4 text-xs text-[#7d8784]">
          <span>{p.current}</span>
          <ChevronRight size={17} />
        </div>
      </div>
    </button>
  );
}
function Avatar({ name, c, photo }: { name: string; c: string; photo?: string }) {
  return (
    <span
      style={{ background: c }}
      className="grid size-12 shrink-0 place-items-center rounded-full font-serif font-bold text-white"
    >
      {photo ? <img src={photo} alt={`Foto de ${name}`} className="size-full rounded-full object-cover" /> : name
        .split(" ")
        .slice(0, 2)
        .map((x) => x[0])
        .join("")}
    </span>
  );
}
function Teams({ people, teams, edit }: { people: Person[]; teams: string[][]; edit: (team:string[], index:number)=>void }) {
  return (
    <>
      <p className="eyebrow">Mapa de equipes</p>
      <h1 className="page-title">Onde cada talento pode florescer</h1>
      <p className="mt-2 max-w-2xl text-[#687572]">
        O sistema cruza as características prioritárias de cada equipe com as
        tags dos perfis.
      </p>
      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((t, i) => {
          const matches = people
            .map((p) => ({
              p,
              s: p.tags.filter((x) => t.slice(1).includes(x)).length,
            }))
            .sort((a, b) => b.s - a.s)
            .filter((x) => x.s)
            .slice(0, 2);
          return (
            <article
              key={t[0]}
              className="rounded-2xl border border-[#dedacf] bg-white p-5 shadow-sm"
            >
              <div className="flex justify-between gap-3">
                <span
                  style={{
                    background: colors[i % 6] + "18",
                    color: colors[i % 6],
                  }}
                  className="grid size-10 place-items-center rounded-xl font-serif font-bold"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex items-center gap-2"><span className="text-xs text-[#84908c]">{matches.length} compatíveis</span><Button variant="ghost" size="icon-sm" onClick={()=>edit(t,i)} aria-label={`Editar ${t[0]}`}><Pencil size={15}/></Button></div>
              </div>
              <h2 className="mt-4 font-serif text-xl font-bold">{t[0]}</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.slice(1).map((x) => (
                  <span
                    key={x}
                    className="rounded-full bg-[#f0eee8] px-2.5 py-1 text-xs"
                  >
                    {x}
                  </span>
                ))}
              </div>
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#89928f]">
                  Sugestões iniciais
                </p>
                {matches.length ? (
                  matches.map(({ p }) => (
                    <div key={p.id} className="flex items-center gap-2 py-1">
                      <Avatar name={p.name} photo={p.photo} c={colors[p.id % 6]} />
                      <b className="text-sm">{p.name}</b>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#8b9491]">
                    Nenhum perfil compatível ainda.
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
function TagsPage({ tags, value, setValue, add }: any) {
  return (
    <>
      <p className="eyebrow">Configuração</p>
      <h1 className="page-title">Tags e talentos</h1>
      <p className="mt-2 text-[#687572]">
        Crie características para associar aos perfis e às equipes.
      </p>
      <div className="mt-7 rounded-2xl border bg-white p-6">
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Ex.: Fotografia, liderança..."
            className="h-11 flex-1 rounded-lg border px-4"
          />
          <Button onClick={add} className="h-11 bg-[#f47a20] text-black hover:bg-[#df6813]">
            <Plus /> Criar tag
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {tags.map((t: string, i: number) => (
            <span
              key={t}
              style={{
                borderColor: colors[i % 6] + "55",
                color: colors[i % 6],
              }}
              className="rounded-full border px-4 py-2 text-sm font-semibold"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
function Profile({
  person,
  teams,
  close,
  edit,
}: {
  person: Person | null;
  teams: string[][];
  close: () => void;
  edit: () => void;
}) {
  if (!person) return null;
  const rec = teams
    .map((t) => ({
      n: t[0],
      s: person.tags.filter((x) => t.slice(1).includes(x)).length,
    }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);
  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Perfil de {person.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Detalhes e equipes recomendadas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-4 border-b pb-5">
          <Avatar name={person.name} photo={person.photo} c={colors[person.id % 6]} />
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-2xl font-bold">{person.name}</h2>
            <p className="text-sm text-[#6f7b77]">
              {person.kind === "jovem" ? "Jovem" : "Casal de tios"} ·{" "}
              {person.community}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={edit}><Pencil/> Editar</Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Info t="Talento principal">
            <span className="rounded-full bg-[#fff0e4] px-3 py-1 text-sm font-bold text-[#c9580d]">
              ★ {person.main}
            </span>
          </Info>
          <Info t="Atuação atual">{person.current}</Info>
          <Info t="Experiências anteriores">{person.history}</Info>
          <Info t="Pontos fortes">
            <div className="flex flex-wrap gap-1">
              {person.tags.map((x) => (
                <span
                  key={x}
                  className="rounded-full bg-[#f0eee8] px-2 py-1 text-xs"
                >
                  {x}
                </span>
              ))}
            </div>
          </Info>
        </div>
        <Info t="Observações">{person.note}</Info>
        <div className="rounded-xl bg-[#fff0e4] p-4">
          <p className="text-xs font-bold uppercase text-[#c9580d]">
            Equipes com maior compatibilidade
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {rec.map((x) => (
              <div key={x.n} className="rounded-lg bg-white p-3">
                <b className="text-sm">{x.n}</b>
                <p className="text-xs text-[#77827f]">
                  {x.s ? `${55 + x.s * 20}% de afinidade` : "A avaliar"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function Info({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#89928f]">
        {t}
      </p>
      <div className="text-sm leading-6">{children}</div>
    </div>
  );
}
function Add({
  open,
  person,
  close,
  save,
  tags,
}: {
  open: boolean;
  person: Person | null;
  close: () => void;
  save: (f: FormData, original?: Person) => void;
  tags: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {person ? "Editar perfil" : "Adicionar novo perfil"}
          </DialogTitle>
          <DialogDescription>
            {person ? "Atualize os dados e a foto deste perfil." : "Cadastre um jovem ou casal de tios."}
          </DialogDescription>
        </DialogHeader>
        <form action={(fd)=>save(fd,person??undefined)} className="grid gap-4 sm:grid-cols-2">
          <label className="field sm:col-span-2">Foto do perfil<div className="flex items-center gap-4 rounded-xl border border-dashed border-[#e5b895] bg-[#fff8f2] p-4">{person?.photo?<img src={person.photo} alt="Foto atual" className="size-16 rounded-full object-cover"/>:<span className="grid size-16 place-items-center rounded-full bg-[#f47a20]/15 text-[#c9580d]"><Camera/></span>}<input type="file" name="photo" accept="image/*" className="flex-1"/></div><small>A imagem fica salva neste navegador.</small></label>
          <Field label="Nome completo / nome do casal" name="name" defaultValue={person?.name} required />
          <label className="field">
            Tipo
            <select name="kind" defaultValue={person?.kind??"jovem"}>
              <option value="jovem">Jovem</option>
              <option value="tios">Casal de tios</option>
            </select>
          </label>
          <Field label="Comunidade" name="community" defaultValue={person?.community} required />
          <Field
            label="Talento principal"
            name="main"
            defaultValue={person?.main}
            list="tag-list"
            required
          />
          <datalist id="tag-list">
            {tags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <Field label="Atribuição atual" name="current" defaultValue={person?.current} />
          <Field label="Experiências anteriores" name="history" defaultValue={person?.history} />
          <label className="field sm:col-span-2">
            Pontos fortes / tags
            <input
              name="tags"
              defaultValue={person?.tags.join(", ")}
              placeholder="Comunicação, acolhimento, instrumento"
            />
            <small>Separe por vírgulas.</small>
          </label>
          <label className="field sm:col-span-2">
            Observações
            <textarea name="note" rows={3} defaultValue={person?.note} />
          </label>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-[#f47a20] text-black hover:bg-[#df6813]">
              {person ? "Salvar alterações" : "Salvar perfil"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      {label}
      <input {...props} />
    </label>
  );
}

function TeamEdit({data,close,save}:{data:{team:string[];index:number}|null;close:()=>void;save:(f:FormData)=>void}){
  return <Dialog open={!!data} onOpenChange={close}><DialogContent><DialogHeader><DialogTitle className="font-serif text-2xl">Editar equipe</DialogTitle><DialogDescription>Altere o nome e os talentos mais importantes para esta equipe.</DialogDescription></DialogHeader>{data&&<form action={save} className="grid gap-4"><Field label="Nome da equipe" name="name" defaultValue={data.team[0]} required/><label className="field">Pontos fortes buscados<input name="skills" defaultValue={data.team.slice(1).join(", ")}/><small>Separe por vírgulas. Essas características definem as sugestões de pessoas.</small></label><DialogFooter><Button type="button" variant="outline" onClick={close}>Cancelar</Button><Button type="submit" className="bg-[#f47a20] text-black hover:bg-[#df6813]">Salvar equipe</Button></DialogFooter></form>}</DialogContent></Dialog>
}
