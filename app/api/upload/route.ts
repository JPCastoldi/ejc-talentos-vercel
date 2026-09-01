import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
export async function POST(req:Request){const data=await req.formData();const file=data.get("file") as File;if(!file)return NextResponse.json({error:"Arquivo ausente"},{status:400});const blob=await put(`perfis/${Date.now()}-${file.name}`,file,{access:"public",addRandomSuffix:true});return NextResponse.json({url:blob.url})}
