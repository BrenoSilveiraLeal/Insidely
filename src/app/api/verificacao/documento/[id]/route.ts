import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/session";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(); if (!user) return NextResponse.json({ error: "N autorizado" }, { status: 401 });
  const { id } = await params; const supabase = await createSupabaseServerClient();
  const { data: doc, error } = await supabase.from("VerificationDocument").select("storageKey").eq("id", id).maybeSingle();
  if (error || !doc) return NextResponse.json({ error: "Documento n encontrado" }, { status: 404 });
  const { data: url, error: signedError } = await supabase.storage.from("verification-documents").createSignedUrl(doc.storageKey, 300);
  if (signedError || !url) return NextResponse.json({ error: "Documento indispon" }, { status: 404 });
  return NextResponse.redirect(url.signedUrl);
}
