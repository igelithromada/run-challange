import {NextResponse} from 'next/server';
export function GET(){return NextResponse.json({error:'Izolovaná testovací verze nemá přístup k produkčnímu serveru.'},{status:403});}
export const POST=GET;export const PATCH=GET;export const DELETE=GET;export const PUT=GET;
