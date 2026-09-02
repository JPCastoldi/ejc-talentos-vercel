"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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
  history: string[];
  birthYear?: number;
  active?: boolean;
  inactiveReason?: string;
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
const colors = [
  "#f47a20",
  "#111111",
  "#d65f0f",
  "#78320c",
  "#ff9a4d",
  "#2d2d2d",
];
const normalizeTag = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

export default function Home() {
  const [view, setView] = useState("inicio"),
    [people, setPeople] = useState<Person[]>([]),
    [teamList, setTeamList] = useState<string[][]>(defaultTeams.map((team) => [team[0], ...team.slice(1).map(normalizeTag)])),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Person | null>(null),
    [deactivating, setDeactivating] = useState<Person | null>(null),
    [editing, setEditing] = useState<Person | null>(null),
    [editingTeam, setEditingTeam] = useState<{
      team: string[];
      index: number;
    } | null>(null),
    [adding, setAdding] = useState(false),
    [customTags, setCustomTags] = useState<string[]>([]),
    [newTag, setNewTag] = useState("");
  const [lastEjc, setLastEjc] = useState(18);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    fetch("/api/data").then(r=>r.ok?r.json():Promise.reject()).then(data=>{
      if(Array.isArray(data.people))setPeople(data.people.map((person: Person & { history?: string | string[] })=>({
        ...person,
        history: Array.isArray(person.history)
          ? person.history
          : person.history
            ? [person.history]
            : [],
        tags: (person.tags || []).map(normalizeTag),
        main: normalizeTag(person.main || ""),
        active: person.active !== false,
      })));
      if(data.teams?.length)setTeamList(data.teams.map((team: string[]) => [team[0], ...team.slice(1).map(normalizeTag)]));
      if(data.tags?.length)setCustomTags(data.tags.map(normalizeTag));
      if(Number.isInteger(data.lastEjc))setLastEjc(data.lastEjc);
    }).catch(()=>{}).finally(()=>setIsLoading(false));
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
    const name = String(fd.get("name") || "").trim();
    const normalizedName = name.toLocaleLowerCase("pt-BR");
    const originalName = original?.name.trim().toLocaleLowerCase("pt-BR");
    if (normalizedName !== originalName && people.some((person) => String(person.id) !== String(original?.id) && person.name.trim().toLocaleLowerCase("pt-BR") === normalizedName)) {
      window.alert("Já existe uma pessoa cadastrada com esse nome.");
      return;
    }
    const history = fd.getAll("history").map((item) => String(item).trim()).filter(Boolean);
    if (!history.length) {
      window.alert("Adicione pelo menos uma experiência anterior.");
      return;
    }
    const invalidEjc = history.find((item) => {
      const match = item.match(/(\d+)\s*º?/);
      return !match || Number(match[1]) > lastEjc;
    });
    if (invalidEjc) {
      window.alert(`Informe o número do EJC em cada experiência. O último realizado é o ${lastEjc}º EJC.`);
      return;
    }
    const normalizedTags = String(fd.get("tags") || "").split(",").map(normalizeTag).filter(Boolean);
    if (!normalizedTags.length) {
      window.alert("Adicione pelo menos um ponto forte.");
      return;
    }
    const file = fd.get("photo") as File;
    let photo = original?.photo;
    if (file?.size) {
      if (file.size > 5 * 1024 * 1024) {
        window.alert("A foto deve ter no máximo 5 MB. Reduza o tamanho da imagem e tente novamente.");
        return;
      }
      const upload=new FormData(); upload.set("file",file); const res=await fetch("/api/upload",{method:"POST",body:upload});
      if(!res.ok) { const result=await res.json().catch(()=>({})); window.alert(result.error || "Não foi possível enviar a foto."); return; }
      photo=(await res.json()).url;
    }
    const p: Person = {
      id: original?.id ?? Date.now(),
      name,
      kind: String(fd.get("kind")) as Kind,
      community: String(fd.get("community")),
      main: normalizeTag(String(fd.get("main"))),
      tags: [...new Set(normalizedTags)],
      current: String(fd.get("current") || ""),
      history,
      birthYear: Number(fd.get("birthYear")) || undefined,
      active: original?.active !== false,
      inactiveReason: original?.inactiveReason,
      note: String(fd.get("note") || ""),
      photo,
    };
    const next = original
      ? people.map((x) => (x.id === original.id ? p : x))
      : [...people, p];
    setPeople(next);
    const saved = await fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"person",person:p})});
    if (!saved.ok) {
      const result = await saved.json().catch(() => ({}));
      setPeople(people);
      window.alert(result.error || "Não foi possível salvar o perfil.");
      return;
    }
    setAdding(false);
    setEditing(null);
    setSelected(null);
    setView(p.kind === "jovem" ? "jovens" : "tios");
  }
  async function updateActiveStatus(person: Person, active: boolean, inactiveReason?: string) {
    if (person.kind !== "jovem") return;
    const previous = people;
    const updated = {
      ...person,
      active,
      inactiveReason: active ? undefined : inactiveReason,
    };
    setPeople((items) => items.map((item) => item.id === person.id ? updated : item));
    setSelected(updated);
    const response = await fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"personStatus",id:person.id,active,inactiveReason})});
    if (!response.ok) {
      setPeople(previous);
      setSelected(person);
      window.alert("Não foi possível alterar o status do jovem.");
    }
  }
  function toggleActive(person: Person) {
    if (person.kind !== "jovem") return;
    if (person.active === false) {
      void updateActiveStatus(person, true);
      return;
    }
    setSelected(null);
    setDeactivating(person);
  }
  async function deleteTag(tag: string) {
    if (!window.confirm(`Excluir a tag "${tag}" dos perfis e das equipes?`)) return;
    const normalized = normalizeTag(tag);
    const updatedPeople = people.map((person) => {
      const personTags = person.tags.filter((item) => normalizeTag(item) !== normalized);
      return {
        ...person,
        tags: personTags,
        main: normalizeTag(person.main) === normalized ? (personTags[0] || "") : person.main,
      };
    });
    const updatedTeams = teamList.map((team) => [team[0], ...team.slice(1).filter((item) => normalizeTag(item) !== normalized)]);
    setPeople(updatedPeople);
    setTeamList(updatedTeams);
    setCustomTags((items) => items.filter((item) => normalizeTag(item) !== normalized));
    const response = await fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"deleteTag",tag:normalized})});
    if (!response.ok) {
      window.alert("Não foi possível excluir a tag.");
      window.location.reload();
    }
  }
  function saveTeam(fd: FormData) {
    if (!editingTeam) return;
    const updated = [
      String(fd.get("name")),
      ...String(fd.get("skills") || "")
        .split(",")
        .map(normalizeTag)
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
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-2.5 sm:px-5 sm:py-3 lg:px-10">
          <button
            onClick={() => setView("inicio")}
            className="flex min-w-0 items-center gap-2.5 text-left sm:gap-3"
          >
            <img
              src="/ejc-logo-brand.png"
              alt="Símbolo do EJC"
              className="size-10 shrink-0 rounded-full object-contain sm:size-12"
            />
            <span>
              <b className="block truncate font-serif text-lg leading-none sm:text-xl">
                EJC Talentos
              </b>
              <small className="hidden text-[#75675d] sm:block">
                Pessoas certas, equipes mais fortes
              </small>
            </span>
          </button>
          <Button
            onClick={() => setAdding(true)}
            className="h-10 shrink-0 rounded-full bg-[#f47a20] px-3 text-black hover:bg-[#df6813] sm:px-5"
          >
            <Plus /> <span className="hidden sm:inline">Novo perfil</span><span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[230px_1fr]">
        <aside className="sticky top-[61px] z-10 border-b border-[#d8d4c8] bg-[#fff8f2]/95 px-3 py-2 backdrop-blur lg:static lg:min-h-[calc(100vh-73px)] lg:border-b-0 lg:border-r lg:p-6">
          <nav className="scrollbar-none flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-2">
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
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4 lg:gap-3 lg:py-3 ${view === id ? "bg-[#ffe5d2] text-[#bd4e08]" : "text-[#675b54] hover:bg-white/70"}`}
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
            <p className="mt-2 font-serif text-2xl">{lastEjc + 1}º EJC</p>
            <p className="mt-1 text-sm text-white/65">Base em preparação</p>
          </div>
        </aside>
        <main className="min-w-0 p-4 sm:p-5 lg:p-10">
          {isLoading && (
            <div className="grid min-h-[45vh] place-items-center rounded-3xl border border-dashed border-[#e2cdbd] bg-white/50 p-8 text-center">
              <div>
                <span className="mx-auto block size-9 animate-spin rounded-full border-4 border-[#f47a20]/25 border-t-[#f47a20]" />
                <p className="mt-4 text-sm font-semibold text-[#746a64]">Carregando dados do EJC...</p>
              </div>
            </div>
          )}
          {!isLoading && view === "inicio" && (
            <Dashboard
              people={people}
              teamCount={teamList.length}
              go={setView}
              open={setSelected}
            />
          )}{" "}
          {!isLoading && (view === "jovens" || view === "tios") && (
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
          {!isLoading && view === "equipes" && (
            <Teams
              people={people}
              teams={teamList}
              edit={(team, index) => setEditingTeam({ team, index })}
            />
          )}{" "}
          {!isLoading && view === "tags" && (
            <TagsPage
              tags={tags}
              lastEjc={lastEjc}
              setLastEjc={(value: number) => {
                if (!Number.isInteger(value) || value < 1) return;
                setLastEjc(value);
                fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"lastEjc",lastEjc:value})});
              }}
              value={newTag}
              setValue={setNewTag}
              add={() => {
                if (!newTag.trim()) return;
                const tag = normalizeTag(newTag);
                if (!tag || tags.includes(tag)) return;
                const n = [...customTags, tag];
                setCustomTags(n);
                fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"tags",tags:n})});
                setNewTag("");
              }}
              remove={deleteTag}
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
        toggleActive={() => selected && toggleActive(selected)}
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
        lastEjc={lastEjc}
      />
      <DeactivateDialog
        person={deactivating}
        close={() => setDeactivating(null)}
        save={(reason) => {
          if (!deactivating) return;
          const person = deactivating;
          setDeactivating(null);
          void updateActiveStatus(person, false, reason);
        }}
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
  const featured = [...people]
    .filter((person) => person.active !== false)
    .sort((a, b) => (b.tags.length + b.history.length) - (a.tags.length + a.history.length))
    .slice(0, 3);
  return (
    <>
      <section className="relative overflow-hidden rounded-3xl bg-[#111] px-5 py-7 text-white sm:rounded-[2rem] sm:px-7 sm:py-9 md:px-10">
        <div className="absolute -right-20 -top-24 size-72 rounded-full border-[45px] border-[#f47a20]/30" />
        <img src="/ejc-logo-brand.png" alt="" className="absolute right-4 top-1/2 hidden h-[86%] w-[34%] -translate-y-1/2 object-contain opacity-30 md:block lg:right-8" />
        <div className="relative max-w-2xl">
          <span className="text-sm font-bold uppercase tracking-[.2em] text-[#ff9a4d]">
            Banco de talentos do encontro
          </span>
          <h1 className="mt-3 font-serif text-3xl leading-tight sm:mt-4 sm:text-4xl md:text-5xl">
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
          n={people.filter((p) => p.kind === "jovem" && p.active !== false).length}
          text="jovens ativos"
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
        <p className="eyebrow">Perfis mais completos</p>
        <h2 className="section-title">Pessoas com mais experiências e talentos</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featured.map((p, i) => (
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
        <Button onClick={add} className="w-full rounded-full bg-[#f47a20] text-black hover:bg-[#df6813] sm:w-fit">
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
  const inactive = p.kind === "jovem" && p.active === false;
  return (
    <button
      onClick={open}
      className={`group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${inactive ? "border-2 border-[#b42318] bg-[#fff4f2]" : "border-[#dedacf] bg-white"}`}
    >
      <div
        className="h-1.5 w-full shrink-0"
        style={{ background: inactive ? "#b42318" : colors[i % colors.length] }}
      />
      <div className="flex min-h-0 w-full flex-1 flex-col p-5">
        <div className="flex items-start gap-4">
          <Avatar name={p.name} photo={p.photo} c={colors[i % colors.length]} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-serif text-xl font-bold">{p.name}</h3>
            <p className="truncate text-sm text-[#73807c]">{p.community}</p>
            {inactive && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#b42318] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white"><AlertTriangle size={12}/> Inativo</span>}
          </div>
        </div>
        {inactive ? (
          <div className="mt-5 rounded-xl border border-[#f4b8b1] bg-white/70 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[#b42318]">Motivo da inativação</p>
            <p className="mt-1 line-clamp-2 break-words text-sm text-[#67251f]">{p.inactiveReason || "Motivo não informado"}</p>
          </div>
        ) : (
          <>
            <div className="mt-5 min-h-6">
              <span className="inline-block max-w-full truncate rounded-full bg-[#fff0e4] px-3 py-1 text-xs font-bold text-[#c9580d]">
                ★ {p.main}
              </span>
            </div>
            <p className="mt-4 min-h-12 line-clamp-2 break-words text-sm leading-6 text-[#65716e]">{p.note || "Sem observações cadastradas."}</p>
          </>
        )}
        <div className="mt-auto flex min-w-0 justify-between border-t border-[#eeeae1] pt-4 text-xs text-[#7d8784]">
          <span className="min-w-0 truncate pr-3">{inactive ? "Clique para ver o motivo" : p.current}</span>
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
      className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full font-serif font-bold text-white"
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
            .filter((p) => p.kind === "tios" || p.active !== false)
            .map((p) => ({
              p,
              s: p.tags.filter((x) => t.slice(1).map(normalizeTag).includes(normalizeTag(x))).length,
            }))
            .sort((a, b) => b.s - a.s)
            .filter((x) => x.s)
            .slice(0, 2);
          return (
            <article
              key={t[0]}
              className="min-w-0 overflow-hidden rounded-2xl border border-[#dedacf] bg-white p-5 shadow-sm"
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
              <h2 className="mt-4 break-words font-serif text-xl font-bold">{t[0]}</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.slice(1).map((x) => (
                  <span
                    key={x}
                    className="max-w-full break-all rounded-full bg-[#f0eee8] px-2.5 py-1 text-xs"
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
                    <div key={p.id} className="flex min-w-0 items-center gap-2 py-1">
                      <Avatar name={p.name} photo={p.photo} c={colors[p.id % 6]} />
                      <b className="min-w-0 break-words text-sm">{p.name}</b>
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
function TagsPage({ tags, value, setValue, add, remove, lastEjc, setLastEjc }: any) {
  return (
    <>
      <p className="eyebrow">Configuração</p>
      <h1 className="page-title">Tags e talentos</h1>
      <p className="mt-2 text-[#687572]">
        Crie e organize as características usadas nos perfis e nas equipes.
      </p>
      <div className="mt-6 max-w-sm rounded-2xl border bg-white p-5">
        <label className="field">
          Último EJC realizado
          <input type="number" min={1} value={lastEjc} onChange={(event) => setLastEjc(Number(event.target.value))} />
          <small>Experiências de encontros posteriores serão bloqueadas.</small>
        </label>
      </div>
      <div className="mt-7 min-w-0 rounded-2xl border bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Ex.: Fotografia, liderança..."
            className="h-11 flex-1 rounded-lg border px-4"
          />
          <Button onClick={add} className="h-11 w-full bg-[#f47a20] text-black hover:bg-[#df6813] sm:w-auto">
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
              className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold sm:px-4"
            >
              <span className="min-w-0 break-all">{t}</span>
              <button type="button" onClick={() => remove(t)} aria-label={`Excluir tag ${t}`} className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-black/10">×</button>
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
  toggleActive,
}: {
  person: Person | null;
  teams: string[][];
  close: () => void;
  edit: () => void;
  toggleActive: () => void;
}) {
  if (!person) return null;
  const inactive = person.kind === "jovem" && person.active === false;
  const rec = teams
    .map((t) => ({
      n: t[0],
      s: person.tags.filter((x) => t.slice(1).map(normalizeTag).includes(normalizeTag(x))).length,
    }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);
  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-h-[90vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Perfil de {person.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Detalhes e equipes recomendadas.
          </DialogDescription>
        </DialogHeader>
        <div className={`flex flex-wrap gap-3 border-b pb-5 sm:flex-nowrap sm:gap-4 ${inactive ? "border-[#efaaa3]" : ""}`}>
          <Avatar name={person.name} photo={person.photo} c={colors[person.id % 6]} />
          <div className="min-w-0 flex-1">
            <h2 className="break-words font-serif text-2xl font-bold">{person.name}</h2>
            <p className="break-words text-sm text-[#6f7b77]">
              {person.kind === "jovem" ? "Jovem" : "Casal de tios"} ·{" "}
              {person.community}
            </p>
            {inactive && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#b42318] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white"><AlertTriangle size={13}/> Jovem inativo</span>}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            {!inactive && <Button className="w-full" variant="outline" size="sm" onClick={edit}><Pencil/> Editar</Button>}
            {person.kind === "jovem" && (
              <Button className={`w-full ${inactive ? "border-[#17803d] bg-[#eefbf2] text-[#116530] hover:bg-[#dff5e6]" : "border-[#e3a49e] text-[#a52a20] hover:bg-[#fff1ef]"}`} variant="outline" size="sm" onClick={toggleActive}>
                {person.active === false ? "Ativar jovem" : "Desativar jovem"}
              </Button>
            )}
          </div>
        </div>
        {inactive ? (
          <div className="rounded-2xl border-2 border-[#b42318] bg-[#fff4f2] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-[#b42318]"><AlertTriangle className="shrink-0"/><p className="font-serif text-xl font-bold">Este jovem está inativo</p></div>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-[#8f241b]">Motivo da inativação</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#57241f]">{person.inactiveReason || "Motivo não informado."}</p>
            <p className="mt-5 border-t border-[#efaaa3] pt-4 text-sm text-[#7b3932]">As informações do perfil e as recomendações de equipes ficam ocultas enquanto o jovem estiver inativo.</p>
          </div>
        ) : <>
        <div className="grid gap-5 sm:grid-cols-2">
          <Info t="Talento principal">
            <span className="rounded-full bg-[#fff0e4] px-3 py-1 text-sm font-bold text-[#c9580d]">
              ★ {person.main}
            </span>
          </Info>
          <Info t="Atuação atual">{person.current}</Info>
          <Info t="Ano de nascimento">
            {person.birthYear ? `${person.birthYear} · ${new Date().getFullYear() - person.birthYear} anos${new Date().getFullYear() - person.birthYear === 29 ? " · último ano para servir como jovem" : ""}` : "Não informado"}
          </Info>
          <Info t="Experiências anteriores">
            {person.history.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {person.history.map((experience, index) => (
                  <li key={`${experience}-${index}`}>{experience}</li>
                ))}
              </ul>
            ) : (
              <span className="text-[#89928f]">Nenhuma experiência cadastrada.</span>
            )}
          </Info>
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
        </>}
      </DialogContent>
    </Dialog>
  );
}

function DeactivateDialog({
  person,
  close,
  save,
}: {
  person: Person | null;
  close: () => void;
  save: (reason: string) => void;
}) {
  if (!person) return null;
  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8 font-serif text-2xl text-[#9b281f]"><AlertTriangle className="shrink-0"/> Inativar jovem</DialogTitle>
          <DialogDescription>
            Informe por que {person.name} ficará inativo. O motivo será exibido ao abrir o perfil.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(formData) => {
            const reason = String(formData.get("inactiveReason") || "").trim();
            if (!reason) return;
            save(reason);
          }}
          className="grid gap-4"
        >
          <label className="field">
            Motivo da inativação
            <textarea
              name="inactiveReason"
              rows={4}
              required
              minLength={3}
              autoFocus
              placeholder="Ex.: completou 30 anos, mudou de comunidade..."
            />
            <small>Esta informação ficará visível no perfil enquanto ele estiver inativo.</small>
          </label>
          <DialogFooter className="[&_button]:w-full sm:[&_button]:w-auto">
            <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
            <Button type="submit" className="bg-[#b42318] text-white hover:bg-[#8e1c13]">Confirmar inativação</Button>
          </DialogFooter>
        </form>
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
  lastEjc,
}: {
  open: boolean;
  person: Person | null;
  close: () => void;
  save: (f: FormData, original?: Person) => void;
  tags: string[];
  lastEjc: number;
}) {
  const [historyItems, setHistoryItems] = useState<string[]>([""]);

  useEffect(() => {
    setHistoryItems(person?.history?.length ? person.history : [""]);
  }, [person, open]);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-h-[92vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {person ? "Editar perfil" : "Adicionar novo perfil"}
          </DialogTitle>
          <DialogDescription>
            {person ? "Atualize os dados e a foto deste perfil." : "Cadastre um jovem ou casal de tios."}
          </DialogDescription>
        </DialogHeader>
        <form action={(fd)=>save(fd,person??undefined)} className="grid gap-4 sm:grid-cols-2">
          <label className="field sm:col-span-2">Foto do perfil<div className="flex flex-col gap-3 rounded-xl border border-dashed border-[#e5b895] bg-[#fff8f2] p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">{person?.photo?<span className="size-16 shrink-0 overflow-hidden rounded-full"><img src={person.photo} alt="Foto atual" className="size-full object-cover"/></span>:<span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f47a20]/15 text-[#c9580d]"><Camera/></span>}<input type="file" name="photo" accept="image/*" className="min-w-0 w-full text-sm"/></div><small>Envie uma imagem de no máximo 5 MB. A foto será salva com o cadastro.</small></label>
          <Field label="Nome completo / nome do casal" name="name" defaultValue={person?.name} required />
          <label className="field">
            Tipo
            <select name="kind" defaultValue={person?.kind??"jovem"}>
              <option value="jovem">Jovem</option>
              <option value="tios">Casal de tios</option>
            </select>
          </label>
          <Field label="Comunidade" name="community" defaultValue={person?.community} required />
          <label className="field">Talento principal
            <select name="main" defaultValue={person?.main || ""} required>
              <option value="" disabled>Selecione um talento</option>
              {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </label>
          <Field label="Ano de nascimento" name="birthYear" type="number" min={1900} max={new Date().getFullYear()} defaultValue={person?.birthYear} />
          <Field label="Atribuição atual" name="current" defaultValue={person?.current} />
          <div className="field sm:col-span-2">
            <span>Experiências anteriores</span>
            <div className="grid gap-2">
              {historyItems.map((experience, index) => (
                <div key={index} className="flex items-stretch gap-2">
                  <input
                    name="history"
                    value={experience}
                    onChange={(event) =>
                      setHistoryItems((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    placeholder="Ex.: Equipe de Círculo — 18º EJC"
                    className="min-w-0 flex-1"
                    required
                  />
                  {historyItems.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      aria-label={`Remover experiência ${index + 1}`}
                      onClick={() =>
                        setHistoryItems((items) =>
                          items.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-fit"
              onClick={() => setHistoryItems((items) => [...items, ""])}
            >
              <Plus /> Adicionar outro EJC
            </Button>
            <small>Cadastre separadamente cada EJC e a equipe. O último realizado é o {lastEjc}º EJC.</small>
          </div>
          <label className="field sm:col-span-2">
            Pontos fortes / tags
            <input
              name="tags"
              defaultValue={person?.tags.join(", ")}
              placeholder="Comunicação, acolhimento, instrumento"
              required
            />
            <small>Separe por vírgulas.</small>
          </label>
          <label className="field sm:col-span-2">
            Observações
            <textarea name="note" rows={3} defaultValue={person?.note} />
          </label>
          <DialogFooter className="sm:col-span-2 [&_button]:w-full sm:[&_button]:w-auto">
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
