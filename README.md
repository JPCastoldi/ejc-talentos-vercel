# EJC Talentos — versão Vercel

Sistema para organizar jovens, casais de tios, talentos e equipes do EJC.

## Publicação

1. Envie todos os arquivos deste pacote para o repositório `JPCastoldi/ejc-talentos`.
2. Na Vercel, escolha **Add New > Project** e importe o repositório.
3. No projeto da Vercel, adicione um banco Neon/Postgres e crie a variável `DATABASE_URL`.
4. Em **Storage**, adicione Vercel Blob; a variável `BLOB_READ_WRITE_TOKEN` será criada.
5. Faça um novo deploy.

Os perfis, equipes e tags serão compartilhados pelo banco. As fotos serão armazenadas permanentemente no Vercel Blob.
"# ejc-talentos-vercel" 
