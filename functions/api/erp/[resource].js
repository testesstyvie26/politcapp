const AUTH_ME="https://cmbusinesstoken.com/politicapp/php/auth/me.php";
const ACCESS={summary:["admin","gestao","operacoes"],demands:["admin","gestao","operacoes"],citizens:["admin","gestao","operacoes"],events:["admin","gestao","operacoes"],projects:["admin","gestao"],reports:["admin","gestao"],users:["admin"]};

async function identity(request){const url=new URL(request.url);let token=url.searchParams.get("_token")||"";if(request.method!=="GET"){const length=Number(request.headers.get("content-length")||0);if(length>32768)return null;const body=await request.clone().json().catch(()=>({}));token=String(body._token||token)}if(!token)return null;const auth=new URL(AUTH_ME);auth.searchParams.set("_token",token);const response=await fetch(auth,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(8000)});if(!response.ok)return null;const data=await response.json();if(!data.ok||!data.autenticado||data.profile?.conta_status!=="aprovado")return null;return {user:data.user,profile:data.profile}}
function allowed(resource,profile){return Boolean(ACCESS[resource]?.includes(profile?.grupo))}
function json(data,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}})}
function sameOrigin(request){const origin=request.headers.get("Origin");return !origin||origin===new URL(request.url).origin}
async function mysqlConnection(env){
  if(!env.ERP_MYSQL)return null;
  const {createConnection}=await import("mysql2/promise");
  return createConnection({host:env.ERP_MYSQL.host,user:env.ERP_MYSQL.user,password:env.ERP_MYSQL.password,database:env.ERP_MYSQL.database,port:env.ERP_MYSQL.port,disableEval:true,connectTimeout:10000});
}

export async function onRequest({request,params,env}){
  const resource=String(params.resource||"");if(!ACCESS[resource])return json({ok:false,error:"Módulo inexistente."},404);
  if(request.method!=="GET"&&!sameOrigin(request))return json({ok:false,error:"Origem não autorizada."},403);
  const account=await identity(request).catch(()=>null);if(!account)return json({ok:false,error:"Sessão inválida."},401);if(!allowed(resource,account.profile))return json({ok:false,error:"Acesso não autorizado para este perfil."},403);
  if(!env.ERP_MYSQL&&!env.ERP_DB)return resource==="summary"?json({ok:true,setupRequired:true,demandsOpen:0,servicesToday:0,eventsWeek:0,projectsActive:0,demands:[],events:[]}):json({ok:false,error:"Banco ERP ainda não vinculado."},503);
  const office=String(account.profile.unidade_id||"central");
  try{
    if(resource==="summary"&&request.method==="GET"&&env.ERP_MYSQL){
      const connection=await mysqlConnection(env);
      try{
        const [[counts],[demands],[events]]=await Promise.all([
          connection.execute("SELECT (SELECT count(*) FROM erp_demands WHERE office_id=? AND status NOT IN ('resolvida','arquivada')) demands_open,(SELECT count(*) FROM erp_services WHERE office_id=? AND date(created_at)=UTC_DATE()) services_today,(SELECT count(*) FROM erp_events WHERE office_id=? AND starts_at>=UTC_TIMESTAMP() AND starts_at<DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY)) events_week,(SELECT count(*) FROM erp_projects WHERE office_id=? AND status='em_andamento') projects_active",[office,office,office,office]),
          connection.execute("SELECT title,concat(priority,' · ',status) subtitle FROM erp_demands WHERE office_id=? AND status NOT IN ('resolvida','arquivada') ORDER BY FIELD(priority,'urgente','alta','normal','baixa'),created_at DESC LIMIT 5",[office]),
          connection.execute("SELECT title,concat(date_format(starts_at,'%d/%m %H:%i'),if(location IS NULL OR location='','',concat(' · ',location))) subtitle FROM erp_events WHERE office_id=? AND starts_at>=UTC_TIMESTAMP() ORDER BY starts_at LIMIT 5",[office])
        ]);
        const count=counts[0]||{};return json({ok:true,storage:"mysql",demandsOpen:Number(count.demands_open||0),servicesToday:Number(count.services_today||0),eventsWeek:Number(count.events_week||0),projectsActive:Number(count.projects_active||0),demands,events});
      }finally{await connection.end()}
    }
    if(resource==="summary"&&request.method==="GET"){
      const [counts,demands,events]=await Promise.all([
        env.ERP_DB.prepare("SELECT (SELECT count(*) FROM erp_demands WHERE office_id=?1 AND status NOT IN ('resolvida','arquivada')) demands_open,(SELECT count(*) FROM erp_services WHERE office_id=?1 AND date(created_at)=date('now')) services_today,(SELECT count(*) FROM erp_events WHERE office_id=?1 AND starts_at>=datetime('now') AND starts_at<datetime('now','+7 day')) events_week,(SELECT count(*) FROM erp_projects WHERE office_id=?1 AND status='em_andamento') projects_active").bind(office).first(),
        env.ERP_DB.prepare("SELECT title,priority||' · '||status subtitle FROM erp_demands WHERE office_id=?1 AND status NOT IN ('resolvida','arquivada') ORDER BY CASE priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 ELSE 2 END,created_at DESC LIMIT 5").bind(office).all(),
        env.ERP_DB.prepare("SELECT title,strftime('%d/%m %H:%M',starts_at)||coalesce(' · '||location,'') subtitle FROM erp_events WHERE office_id=?1 AND starts_at>=datetime('now') ORDER BY starts_at LIMIT 5").bind(office).all()
      ]);return json({ok:true,demandsOpen:counts?.demands_open||0,servicesToday:counts?.services_today||0,eventsWeek:counts?.events_week||0,projectsActive:counts?.projects_active||0,demands:demands.results||[],events:events.results||[]});
    }
    return json({ok:false,error:"Operação ainda não implementada para este módulo."},405);
  }catch(error){console.error(JSON.stringify({event:"erp_request_failed",resource,message:String(error)}));return json({ok:false,error:"Não foi possível consultar o ERP."},500)}
}
