import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requestIsAdmin } from "@/lib/admin-auth";

export async function POST(req: Request) {
  if(!requestIsAdmin(req))return NextResponse.json({error:"Entre com a senha administrativa para enviar fotos."},{status:401});
  if(!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({error:"Vercel Blob não configurado. Adicione BLOB_READ_WRITE_TOKEN ao projeto."},{status:503});
  const data=await req.formData();
  const file=data.get("file");
  if(!(file instanceof File)||!file.size)return NextResponse.json({error:"Arquivo ausente"},{status:400});
  if(!file.type.startsWith("image/"))return NextResponse.json({error:"Envie uma imagem válida"},{status:415});
  if(file.size>4*1024*1024)return NextResponse.json({error:"A imagem deve ter no máximo 4 MB"},{status:413});
  const extension=(file.name.split(".").pop()||file.type.split("/")[1]||"jpg").replace(/[^a-zA-Z0-9]/g,"");
  const blob=await put(`perfis/${Date.now()}.${extension}`,file,{access:"public",addRandomSuffix:true,contentType:file.type});
  return NextResponse.json({url:blob.url});
}
