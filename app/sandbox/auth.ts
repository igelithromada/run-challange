import {state,save,subscribe,TEST_UID} from './store';
import { installSandboxFetch } from './transport';
export const tester:any={uid:TEST_UID,email:'tester@example.invalid',displayName:'TEST · Tvůj účet',emailVerified:true,isAnonymous:true,getIdToken:async()=> 'sandbox-local-only',getIdTokenResult:async()=>({claims:{},token:'sandbox-local-only'})};
export const sandboxAuth:any={get currentUser(){return state().signedIn?tester:null;},languageCode:'cs'};
export function onAuthStateChanged(_auth:any,callback:any){installSandboxFetch();let previous=sandboxAuth.currentUser;queueMicrotask(()=>callback(previous));return subscribe(()=>{const user=sandboxAuth.currentUser;if(user!==previous){previous=user;callback(user);}});}
export async function enterSandbox(){installSandboxFetch();state().signedIn=true;save();return {user:tester};}
export async function signOut(){state().signedIn=false;save();}
export const getAuth=()=>sandboxAuth;
export async function signInWithEmailAndPassword(){throw new Error('V testovací verzi použij tlačítko Vstoupit jako tester.');}
export const signInWithCustomToken=enterSandbox;
export async function sendPasswordResetEmail(){throw new Error('Testovací účet nemá heslo ani e-mailovou schránku.');}
export async function updatePassword(){throw new Error('Hesla se v testovací verzi nepoužívají.');}
