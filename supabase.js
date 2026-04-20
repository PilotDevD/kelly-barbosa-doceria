/* ============================================================
   CONFIGURAÇÃO DO SUPABASE
   ------------------------------------------------------------
   Kelly, siga o passo a passo do arquivo README.md para:
     1) Criar sua conta no Supabase
     2) Criar o projeto
     3) Copiar a URL e a chave ANON
   Depois, substitua os dois valores abaixo.
   ============================================================ */

const SUPABASE_URL = 'https://weybrfvxbfjzrsktlnwe.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndleWJyZnZ4YmZqenJza3RsbndlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NDU3MjEsImV4cCI6MjA5MjIyMTcyMX0.TOIIPbS0_JSZ75qx2OiVslHFtag9sogV8gSgWCReSTQ';

// Não mexer daqui para baixo 👇
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});
