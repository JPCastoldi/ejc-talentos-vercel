# EJC Talentos — versão Vercel

Sistema de cadastro de jovens, casais de tios, talentos e montagem das equipes do EJC.

## Variáveis de ambiente

Configure no projeto da Vercel para Production, Preview e Development:

```env
DATABASE_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
ADMIN_PASSWORD=uma_senha_forte
ADMIN_SESSION_SECRET=um_valor_longo_e_aleatorio
```

- `DATABASE_URL`: conexão PostgreSQL/Neon.
- `BLOB_READ_WRITE_TOKEN`: criado ao conectar um Vercel Blob público ao projeto.
- `ADMIN_PASSWORD`: senha usada pelos responsáveis para liberar as alterações no site.
- `ADMIN_SESSION_SECRET`: segredo aleatório usado para assinar a sessão administrativa. Gere com `openssl rand -base64 48`.

O conteúdo pode ser consultado sem login. Cadastro, edição, inativação, exclusão, upload de fotos, tags e montagem de equipes exigem a senha administrativa. A sessão expira após 12 horas e fica em cookie seguro `HttpOnly`.

## Banco de dados

As tabelas relacionais são criadas automaticamente no primeiro acesso:

- `ejc_profiles`: jovens e casais de tios.
- `ejc_tags`: talentos disponíveis.
- `ejc_profile_tags`: pontos fortes de cada perfil.
- `ejc_experiences`: experiências anteriores.
- `ejc_teams`: equipes do EJC.
- `ejc_team_tags`: talentos buscados por equipe.
- `ejc_encounters`: encontros concluídos e em planejamento.
- `ejc_team_assignments`: escalação dos perfis nas equipes.
- `ejc_migrations`: controle das migrações automáticas.

As tabelas antigas `ejc_people` e `ejc_settings` são preservadas como backup. Os registros existentes são migrados automaticamente uma única vez. Fotos antigas em Base64 são transferidas para o Blob assim que `BLOB_READ_WRITE_TOKEN` estiver disponível.

## Executar localmente

```bash
npm install
npm run dev
```

## Publicar

Depois de conectar o banco e o Blob ao projeto:

```bash
vercel --prod
```
