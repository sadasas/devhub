import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { Task } from "../../lib/types";
import { useProject } from "../../state/project-context";
import { TASK_STATUS, TASK_PRIORITY, TASK_PRIORITY_SHORT } from "../../lib/labels";
import { addDaysToDate, barGeometry, clampGroup, isUnscheduled, isWeekend, timelineWindow, headerMonthLabel, todayIso, TIMELINE_COL_WIDTH, type TimelineGroup } from "../../lib/timeline";
import { avatarColor, initialsOf } from "../../lib/avatar";
import { api } from "../../lib/api";

interface BoardTimelineProps {
  filteredTasks: Task[];
  onOpenTask: (id: string) => void;
  members: Record<string, { email: string; displayName?: string }>;
  unreadIds?: ReadonlySet<string>;
  userId?: string | null;
  mineOnly?: boolean;
  onNewTaskAt?: (t: { startDate?: string | null; dueDate?: string | null }) => void;
  onTouchDrop?: (taskId: string, dropKey: string | null) => void;
}
const BAR_H = 100;
const ROW_H = 108;
const ROW_TOP = 4;
function dayIndex(iso: string): number { return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000); }
function packLane(tasks: Task[]): { rowOf: Map<string, number>; rowsNeeded: number } {
  const sorted = [...tasks].sort((a,b)=> a.startDate!.localeCompare(b.startDate!) || a.dueDate!.localeCompare(b.dueDate!));
  const trackEnd: number[] = [];
  const rowOf = new Map<string, number>();
  for (const t of sorted) {
    let s = t.startDate!, e = t.dueDate!; if (s>e) [s,e]=[e,s];
    const sIdx = dayIndex(s), eIdx = dayIndex(e);
    let placed = -1;
    for (let r=0;r<trackEnd.length;r++) if (sIdx > (trackEnd[r] ?? -1)) { placed=r; break; }
    if (placed===-1) { placed=trackEnd.length; trackEnd.push(eIdx); } else trackEnd[placed]=eIdx;
    rowOf.set(t.id, placed);
  }
  return { rowOf, rowsNeeded: Math.max(1, trackEnd.length) };
}
export function BoardTimeline({ filteredTasks, onOpenTask, members, unreadIds }: BoardTimelineProps) {
  const { t } = useTranslation("tracker");
  const { state, dispatch, canEdit, projectId } = useProject() as any;
  const [searchParams, setSearchParams] = useSearchParams();
  const group = clampGroup(searchParams.get("group"));
  const hideCompleted = searchParams.get("hideCompleted") === "1";
  const zoom = "day" as const; const colW = TIMELINE_COL_WIDTH[zoom];
  useEffect(()=>{ if(searchParams.get("zoom")!==null || searchParams.get("plot")!==null){ setSearchParams(prev=>{const p=new URLSearchParams(prev); p.delete("zoom"); p.delete("plot"); return p;},{replace:true});}},[searchParams,setSearchParams]);
  const setGroup = (g: TimelineGroup)=> setSearchParams(prev=>{const pp=new URLSearchParams(prev); pp.set("group",g); return pp;},{replace:true});
  const setHideCompleted = (v:boolean)=> setSearchParams(prev=>{const pp=new URLSearchParams(prev); if(v) pp.set("hideCompleted","1"); else pp.delete("hideCompleted"); return pp;},{replace:true});
  const today = todayIso(); const [anchor,setAnchor]=useState(today); const win=useMemo(()=>timelineWindow(anchor,7,28),[anchor]); const totalWidth=win.days.length*colW; const monthHeaders=useMemo(()=>headerMonthLabel(win.days),[win.days]);
  const visibleTasks = useMemo(()=>{ let list=filteredTasks; if(hideCompleted) list=list.filter(t=>t.status!=="done"); return list;},[filteredTasks,hideCompleted]);
  const scheduled = useMemo(()=> visibleTasks.filter(t=>!isUnscheduled(t)),[visibleTasks]);
  const unscheduled = useMemo(()=> visibleTasks.filter(t=>isUnscheduled(t)),[visibleTasks]);
  // virtualisasi horizontal: hanya bar yang overlap window yang dirender (100k -> ~1k)
  const windowedScheduled = useMemo(()=> scheduled.filter(t=>{
    const s=t.startDate!, e=t.dueDate!;
    // normalize swap
    const a = s<=e ? s : e;
    const b = s<=e ? e : s;
    return !(b < win.start || a > win.end);
  }),[scheduled, win.start, win.end]);
  const timelineOrder: Record<string,string[]> = (state as any)?.timelineOrder ?? {};
  const getLaneKey = (laneKey:string)=> `${group}:${laneKey}`;
  const ordered = useCallback((tasks: Task[], laneKey:string)=>{
    const order = timelineOrder[getLaneKey(laneKey)];
    if(!order || order.length===0) return [...tasks].sort((a,b)=> a.startDate!.localeCompare(b.startDate!) || a.dueDate!.localeCompare(b.dueDate!));
    const pos = new Map(order.map((id,i)=>[id,i]));
    return [...tasks].sort((a,b)=>{
      const ai = pos.has(a.id) ? pos.get(a.id)! : 1e9;
      const bi = pos.has(b.id) ? pos.get(b.id)! : 1e9;
      if(ai!==bi) return ai-bi;
      return a.startDate!.localeCompare(b.startDate!) || a.dueDate!.localeCompare(b.dueDate!);
    });
  },[timelineOrder, group]);
  const lanes = useMemo(()=>{
    if(group==="none") return [{key:"all", label:t("board.timeline.laneAll",{defaultValue:"All tasks"}), tasks: ordered(scheduled,"all") }];
    if(group==="milestone"){
      const order=(m:{status:string;targetDate?:string|null}):number=> m.status==="planned"?0:m.status==="inProgress"?1:2;
      const milestones=[...(state?.milestones??[])].sort((a,b)=>{const o=order(a)-order(b); if(o!==0) return o; return (a.targetDate??"9999-99-99").localeCompare(b.targetDate??"9999-99-99");});
      const lanesM: Array<{key:string;label:string;sub?:string;tasks:Task[]}> = milestones.map(m=>({key:m.id,label:m.name,sub:m.version??undefined,tasks: ordered(scheduled.filter(t=>t.milestoneId===m.id), m.id)}));
      lanesM.push({key:"unassigned",label:t("board.unassigned",{defaultValue:"Unassigned"}),tasks: ordered(scheduled.filter(t=>!t.milestoneId),"unassigned")});
      return lanesM;
    }
    const memberEntries=Object.entries(members ?? {});
    const byAssignee=new Map<string|null,Task[]>();
    for(const t of windowedScheduled){const k=t.assigneeId??null; const arr=byAssignee.get(k)??[]; arr.push(t); byAssignee.set(k,arr);}
    const sortedMembers=memberEntries.sort((a,b)=>(a[1].displayName||a[1].email).localeCompare(b[1].displayName||b[1].email));
    const lanesA: Array<{key:string;label:string;tasks:Task[]}>=[];
    for(const [id,info] of sortedMembers){ const tasksFor=ordered(byAssignee.get(id)??[], id); if(tasksFor.length===0) continue; lanesA.push({key:id,label:info.displayName||info.email,tasks:tasksFor});}
    const unassignedTasks=ordered(byAssignee.get(null)??[], "unassigned");
    if(unassignedTasks.length>0 || lanesA.length===0) lanesA.push({key:"unassigned",label:t("board.timeline.unassigned",{defaultValue:"Unassigned"}),tasks:unassignedTasks});
    if(lanesA.length===0) lanesA.push({key:"all",label:t("board.timeline.laneAll",{defaultValue:"All tasks"}),tasks:[]});
    return lanesA;
  },[group,scheduled,state?.milestones,members,t, ordered]);
  const packed = useMemo(()=>{
    return lanes.map(lane=>{
      const {rowOf, rowsNeeded}= packLane(lane.tasks);
      return {...lane, rowOf, rowsNeeded};
    });
  },[lanes]);
  const todayOffset = useMemo(()=>{const idx=win.days.indexOf(today); if(idx===-1) return null; return idx*colW;},[win.days,today,colW]);
  const gridRef=useRef<HTMLDivElement>(null); const headerRef=useRef<HTMLDivElement>(null); const laneRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const grid=gridRef.current; const header=headerRef.current; const lanesEl=laneRef.current;
    if(!grid||!header) return;
    const onScroll=()=>{header.scrollLeft=grid.scrollLeft; if(lanesEl) lanesEl.scrollTop=grid.scrollTop;};
    grid.addEventListener("scroll",onScroll,{passive:true});
    return()=> grid.removeEventListener("scroll",onScroll);
  },[]);
  useEffect(()=>{
    const grid=gridRef.current; const header=headerRef.current;
    if(!grid || todayOffset==null) return;
    const target=Math.max(0, todayOffset - grid.clientWidth/2 + colW/2);
    const smooth = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    requestAnimationFrame(()=>{
      grid.scrollTo({left: target, behavior: smooth as any});
      if(header) header.scrollLeft=target;
    });
  },[todayOffset, colW]);
  const onNav=(dir:number)=> setAnchor(addDaysToDate(anchor, dir*7));
  const onToday=useCallback(()=>{
    const t=todayIso();
    const grid=gridRef.current; const header=headerRef.current;
    if(t===anchor && todayOffset!=null && grid){
      const target=Math.max(0, todayOffset - grid.clientWidth/2 + colW/2);
      const smooth = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
      grid.scrollTo({left: target, behavior: smooth as any});
      if(header) header.scrollLeft=target;
      return;
    }
    setAnchor(t);
  },[anchor, todayOffset, colW]);
  const [dragId,setDragId]=useState<string|null>(null);
  const [ghostDate,setGhostDate]=useState<string|null>(null);
  const handleBarDragStart=useCallback((e:React.DragEvent,task:Task)=>{e.dataTransfer.setData("text/plain",task.id); e.dataTransfer.effectAllowed="move"; setDragId(task.id); setGhostDate(task.startDate ?? null);},[]);
  const handleDragEnd=useCallback(()=>{ setDragId(null); setGhostDate(null);},[]);
  const handleGridDragOver=useCallback((e:React.DragEvent)=>{
    if(!dragId) return;
    const grid=gridRef.current; if(!grid) return;
    const rect=grid.getBoundingClientRect();
    const x=e.clientX - rect.left + grid.scrollLeft;
    const dayIdx=Math.floor(x / colW);
    const clamped=Math.max(0,Math.min(win.days.length-1,dayIdx));
    const gd=win.days[clamped] ?? null;
    if(gd!==ghostDate) setGhostDate(gd);
    e.preventDefault(); e.dataTransfer.dropEffect="move";
  },[dragId, ghostDate, colW, win.days]);
  const handleGridDrop=useCallback((e:React.DragEvent,targetDate:string|null)=>{
    e.preventDefault(); const id=e.dataTransfer.getData("text/plain"); if(!id||!canEdit) return; const task=state?.tasks.find((t:any)=>t.id===id); if(!task) return;
    setDragId(null); setGhostDate(null);
    if(targetDate==null){ if(task.startDate==null && task.dueDate==null) return; dispatch({type:"task/update",id,patch:{startDate:null,dueDate:null}}); return; }
    if(task.startDate && task.dueDate){ const span=Math.max(0,(new Date(`${task.dueDate}T00:00:00Z`).getTime()-new Date(`${task.startDate}T00:00:00Z`).getTime())/86400000); const newStart=targetDate; const newEnd=addDaysToDate(newStart,span); if(newStart===task.startDate && newEnd===task.dueDate) return; dispatch({type:"task/update",id,patch:{startDate:newStart,dueDate:newEnd}});} else { const newStart=targetDate; const newEnd=addDaysToDate(targetDate,2); dispatch({type:"task/update",id,patch:{startDate:newStart,dueDate:newEnd}});}
  },[canEdit,state,dispatch]);
  const handleBarClick=(task:Task)=>{ onOpenTask(task.id);};
  const moveInLane = (laneKey:string, taskId:string, dir:number)=>{
    const lane = packed.find(l=>l.key===laneKey); if(!lane) return;
    const arr = [...lane.tasks]; const idx=arr.findIndex(t=>t.id===taskId); if(idx===-1) return; const nxt=idx+dir; if(nxt<0||nxt>=arr.length) return;
    const newOrder=[...arr]; const [moved]=newOrder.splice(idx,1); newOrder.splice(nxt,0,moved!);
    const ids=newOrder.map((t: Task)=>t.id);
    const key=getLaneKey(laneKey);
    dispatch({type:"timeline/reorder", laneKey:key, ids} as any);
    // persist to project state (shared)
    const newMap={...(timelineOrder||{}), [key]:ids};
    api.patchTimelineOrder(projectId, newMap).catch(()=>{});
  };
  return (
    <div className="tl-root" data-zoom={zoom} style={{width:"100%", minWidth:0, contain:"inline-size"}}>
      <div className="tl-toolbar" style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        <div className="sub-tabs" role="tablist" aria-label={t("board.timeline.groupLabel",{defaultValue:"Group"})}>
          {(["none","milestone","assignee"] as TimelineGroup[]).map(g=> (
            <button key={g} type="button" role="tab" className={`sub-tab ${group===g?"sub-tab-active":""}`} aria-selected={group===g} onClick={()=>setGroup(g)}>{t(`board.timeline.group.${g}`,{defaultValue:g==="none"?"None":g==="milestone"?"Milestone":"Assignee"})}</button>
          ))}
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          <Button variant="ghost" size="sm" onClick={onToday}>{t("board.timeline.today",{defaultValue:"Today"})}</Button>
          <label className="toolbar-check" style={{fontSize:12}}><input type="checkbox" checked={hideCompleted} onChange={e=>setHideCompleted(e.target.checked)} />{t("board.cal.hideCompleted",{defaultValue:"Hide completed"})}</label>
        </div>
      </div>
      <div className="tl-unscheduled" data-drop-key="clear" onDragOver={e=>{e.preventDefault(); e.dataTransfer.dropEffect="move";}} onDrop={e=>handleGridDrop(e,null)} style={{display:"flex",gap:6,alignItems:"center",padding:"8px 10px",background:"var(--bg-inset)",border:"1px solid var(--border-hairline)",borderRadius:"var(--radius-card)",marginBottom:12,overflowX:"auto",overflowY:"hidden",minHeight:44,maxWidth:"100%",minWidth:0,width:"100%",overscrollBehaviorX:"contain",touchAction:"pan-x",scrollbarWidth:"thin",WebkitOverflowScrolling:"touch" as any}}>
        <span style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--text-muted)",whiteSpace:"nowrap",flexShrink:0}}>Unscheduled ({unscheduled.length})</span>
        {unscheduled.length===0 && <span style={{fontSize:12,color:"var(--text-muted)",fontStyle:"italic"}}>{t("board.timeline.unscheduledEmpty",{defaultValue:"No unscheduled tasks — drag bar here to clear dates"})}</span>}
        {unscheduled.map(task=> (
          <button key={task.id} type="button" className="tl-unscheduled-chip" draggable={canEdit} onDragStart={e=>handleBarDragStart(e,task)} onClick={()=>onOpenTask(task.id)} title={task.title} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 8px",background:"var(--bg-overlay)",border:"1px solid var(--border-hairline)",borderRadius:"var(--radius-pill)",fontSize:12,whiteSpace:"nowrap",cursor:canEdit?"grab":"pointer",flexShrink:0}}>
            <span style={{maxWidth:140,overflow:"hidden",textOverflow:"ellipsis"}}>{task.title}</span>
            {unreadIds?.has(task.id) && <span className="unread-pill" style={{fontSize:10,padding:"1px 4px"}}>New</span>}
          </button>
        ))}
      </div>
      <div className="tl-wrap" style={{display:"grid",gridTemplateColumns:"var(--lane-w) 1fr",gridTemplateRows:"76px 1fr",border:"1px solid var(--border-hairline)",borderRadius:"var(--radius-card)",overflow:"hidden",background:"var(--bg-elevated)",width:"100%",minWidth:0}}>
          <div style={{background:"var(--bg-elevated)",borderBottom:"1px solid var(--border-strong)",borderRight:"1px solid var(--border-hairline)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px",height:76,position:"sticky",top:0,left:0,zIndex:4, minWidth:0}}>
            <span style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--text-muted)"}}>{t("board.timeline.laneTasks",{defaultValue:"Tasks"})}</span>
            <span style={{display:"flex",gap:4}}>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t("board.timeline.prev",{defaultValue:"Previous"})} onClick={()=>onNav(-1)}><CaretLeft size={14} aria-hidden="true" /></button>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t("board.timeline.next",{defaultValue:"Next"})} onClick={()=>onNav(1)}><CaretRight size={14} aria-hidden="true" /></button>
            </span>
          </div>
          <div ref={headerRef} style={{overflow:"hidden",borderBottom:"1px solid var(--border-strong)",background:"var(--bg-elevated)",position:"sticky",top:0,zIndex:2,minWidth:0}}>
            <div style={{display:"flex",height:32,borderBottom:"1px solid var(--border-hairline)"}}>
              {monthHeaders.map(mh=> (<div key={mh.key} style={{flex:`0 0 ${mh.span*colW}px`,width:mh.span*colW,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--font-mono)",fontSize:11,letterSpacing:"0.06em",textTransform:"uppercase",color:"var(--text-muted)",borderRight:"1px solid var(--border-hairline)",whiteSpace:"nowrap",overflow:"hidden"}}>{mh.label}</div>))}
            </div>
            <div style={{display:"flex",height:44}}>
              {win.days.map(d=>{const isToday=d===today; const weekend=isWeekend(d); return <div key={d} style={{flex:`0 0 ${colW}px`,width:colW,borderRight:"1px solid var(--border-hairline)",display:"grid",placeItems:"center",padding:"4px 0",background:isToday?"var(--accent-dim)":weekend?"var(--bg-weekend, rgba(255,255,255,0.02))":"transparent"}}><span style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:600,color:isToday?"var(--accent)":"var(--text-primary)",lineHeight:1}}>{d.slice(8)}</span><span style={{fontSize:10.5,color:"var(--text-muted)",lineHeight:1}}>{new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined,{weekday:"short"}).slice(0,3)}</span></div>;})}
            </div>
          </div>
          <div ref={laneRef} className="tl-lane" style={{overflow:"hidden",overflowY:"auto",scrollbarWidth:"thin",maxHeight:"60vh",position:"sticky",left:0,zIndex:2,background:"var(--bg-elevated)",minWidth:0,overscrollBehavior:"contain"}}>
            {packed.map((lane:any,idx:number)=>{
              const h = lane.tasks.length===0 ? 100 : Math.max(136, lane.rowsNeeded*ROW_H+16);
              return <div key={lane.key} style={{height: h, minHeight:36, display:"flex",alignItems:lane.tasks.length?"flex-start":"center",gap:8,padding:"6px 10px",borderBottom:"1px solid var(--border-hairline)",borderRight:"1px solid var(--border-hairline)",background: idx%2===1?"var(--bg-stripe, rgba(255,255,255,0.015))":"transparent",position:"relative"}}>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={lane.label}>{lane.label}</div>{"sub" in lane && (lane as any).sub && <div style={{fontSize:10,fontFamily:"var(--font-mono)",color:"var(--text-muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(lane as any).sub}</div>}<div style={{fontSize:11,fontFamily:"var(--font-mono)",color:"var(--text-muted)"}} className="tabular">{lane.tasks.length} tasks · {lane.rowsNeeded} rows</div>{lane.tasks.length===0 && <div style={{fontSize:11, color:"var(--text-muted)", fontStyle:"italic", marginTop:2}}>No tasks</div>}</div>
              </div>;
            })}
          </div>
          <div ref={gridRef} className="tl-grid" style={{overflow:"auto",position:"relative",maxHeight:"60vh",minWidth:0,overscrollBehavior:"contain"}} onDragOver={handleGridDragOver} onDragLeave={(e)=>{ if(e.target===e.currentTarget) setGhostDate(null); }}>
            <div style={{position:"relative",width:totalWidth,minWidth:totalWidth}}>
              {packed.map((lane:any, laneIdx:number)=>{
                const h = lane.tasks.length===0 ? 100 : Math.max(136, lane.rowsNeeded*ROW_H+16);
                return <div key={lane.key} style={{position:"relative",height: h, minHeight:36, borderBottom:"1px solid var(--border-hairline)",background: laneIdx%2===1?"var(--bg-stripe, rgba(255,255,255,0.015))":"transparent"}} onDragOver={handleGridDragOver} onDrop={e=>{const grid=gridRef.current; if(!grid) return; const gridRect=grid.getBoundingClientRect(); const x=e.clientX-gridRect.left+grid.scrollLeft; const dayIdx=Math.floor(x/colW); const targetDate=win.days[Math.max(0,Math.min(win.days.length-1,dayIdx))]??null; const laneRect=(e.currentTarget as HTMLElement).getBoundingClientRect(); const y=e.clientY-laneRect.top; const targetRow=Math.floor((y-ROW_TOP)/ROW_H); const draggedId=e.dataTransfer.getData("text/plain"); const laneTasks=lane.tasks; const curIdx=laneTasks.findIndex((tt: Task)=>tt.id===draggedId); const fromRow=lane.rowOf.get(draggedId) ?? curIdx; if(targetRow!==fromRow && curIdx!==-1 && draggedId){ const targetTask=laneTasks.find((tt: Task)=> (lane.rowOf.get(tt.id)??0)===targetRow); if(targetTask){ const targetIdx=laneTasks.findIndex((tt: Task)=>tt.id===targetTask.id); let steps=Math.abs(targetIdx-curIdx); let dir= targetIdx>curIdx?1:-1; for(let s=0;s<steps;s++) moveInLane(lane.key, draggedId, dir); } } handleGridDrop(e,targetDate);}}>
                  <div style={{position:"absolute",inset:0,display:"flex",pointerEvents:"none"}} aria-hidden="true">{win.days.map(d=>(<div key={d} style={{flex:`0 0 ${colW}px`,width:colW,borderRight: d===today?"1px solid var(--accent)":"1px solid var(--border-hairline)",opacity: d===today?1:0.6,background: d===today?"var(--accent-dim)": isWeekend(d)?"var(--bg-weekend, rgba(255,255,255,0.02))":"transparent"}} />))}</div>
                  {todayOffset!=null && (<><div aria-hidden="true" style={{position:"absolute",top:0,bottom:0,left:todayOffset,width:colW,background:"var(--accent-dim)",opacity:0.15,pointerEvents:"none"}} /><div aria-hidden="true" style={{position:"absolute",top:0,bottom:0,left:todayOffset,width:1.5,background:"var(--accent)",zIndex:2,pointerEvents:"none"}} /></>)}
                  {lane.tasks.map((task:Task)=>{
                    const geom=barGeometry(task, win.start, zoom); if(!geom) return null;
                    const row=lane.rowOf.get(task.id) ?? 0; const top=ROW_TOP+row*ROW_H;
                    const isDone=task.status==="done";
                    const isOverdue=!isDone && task.dueDate && task.dueDate < today;
                    const tone:string=isDone?"done":isOverdue?"danger":"neutral";
                    let bg="#e0e7ff";
                    if(isDone) bg="#6ee7b7";
                    else if(tone==="danger") bg="#fecaca";
                    const textColor = isDone ? "#064e3b" : "#1e293b";
                    const border = isDone ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.08)";
                    const borderStyle = isDone ? "dashed" : "solid";
                    const shadow = isDone ? "none" : "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.10)";
                    const statusMeta = TASK_STATUS[task.status];
                    const prioMeta = TASK_PRIORITY[task.priority];
                    const assignee = task.assigneeId ? (members as any)?.[task.assigneeId] : undefined;
                    const assigneeName = assignee ? (assignee.displayName || assignee.email) : undefined;
                    const showAssigneeName = geom.width >= 140;
                    return <div key={task.id} role="group" aria-label={`${task.title}, ${geom.startDate} to ${geom.endDate}, ${task.status}, ${task.priority}`} style={{position:"absolute",left:geom.left,top,width:geom.width,height:BAR_H}}>
                      <button type="button" aria-label={`${task.title}, ${geom.startDate} to ${geom.endDate}, ${TASK_STATUS[task.status].label}`} draggable={canEdit} onDragStart={e=>handleBarDragStart(e,task)} onDragEnd={handleDragEnd} onClick={()=>handleBarClick(task)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault(); handleBarClick(task);}}} title={`${task.title} · ${geom.startDate}→${geom.endDate} (${geom.spanDays}d) · ${TASK_STATUS[task.status].label}`} style={{width:"100%",height:BAR_H,borderRadius:"var(--radius-card)",border:`1px ${borderStyle} ${border}`,background:bg,boxShadow:shadow,display:"flex",flexDirection:"column",alignItems:"stretch",justifyContent:"flex-start",padding:"7px 8px 6px 8px",gap:4,cursor:canEdit?"grab":"pointer",opacity:1,overflow:"hidden",minWidth:0}}>
                      <span style={{display:"flex",alignItems:"center",gap:4,minWidth:0,flexShrink:0}}>
                        <span className="badge" style={{fontSize:10, padding:"2px 6px", lineHeight:1, background: (statusMeta as any).tone==='success' ? '#0e7a4a' : (statusMeta as any).tone==='danger' ? '#dc2626' : (statusMeta as any).tone==='warn' ? '#d97706' : (statusMeta as any).tone==='info' ? '#2563eb' : '#52525b', color:"#fff", borderColor:"transparent", fontWeight:600, boxShadow:"0 1px 2px rgba(0,0,0,0.12)"}}>{statusMeta.label}</span>
                        <span className="badge" style={{fontSize:10, padding:"2px 5px", marginLeft:"auto", lineHeight:1, background: (prioMeta as any).tone==='danger' ? '#dc2626' : (prioMeta as any).tone==='warn' ? '#d97706' : (prioMeta as any).tone==='info' ? '#2563eb' : '#52525b', color:"#fff", borderColor:"transparent", fontWeight:600, boxShadow:"0 1px 2px rgba(0,0,0,0.12)"}}>{TASK_PRIORITY_SHORT[task.priority]}</span>
                        {unreadIds?.has(task.id) && <span className="unread-pill" style={{fontSize:9, padding:"1px 4px", lineHeight:1}}>New</span>}
                      </span>
                      <span style={{flex:"0 1 auto",minHeight:0,maxHeight:"28px",display:"-webkit-box",WebkitBoxOrient:"vertical",WebkitLineClamp:2,lineClamp:"2" as any,overflow:"hidden",overflowWrap:"break-word",wordBreak:"break-word",hyphens:"auto",lineHeight:"14px",fontSize:12,fontWeight:600,color:textColor,textAlign:"left"}}>{task.title}</span>
                      <span style={{display:"flex",alignItems:"center",gap:6,minWidth:0,flexShrink:0,marginTop:"auto"}}>
                        {assigneeName ? (
                          <span className="task-avatar" title={assigneeName} style={{gap:4, fontSize:10, minWidth:0}}>
                            <span className="task-assignee-avatar" style={{width:16,height:16,fontSize:9,backgroundColor: avatarColor(task.assigneeId!)}}>{initialsOf(assigneeName)}</span>
                            {showAssigneeName && <span className="task-assignee-name" style={{maxWidth:72, fontSize:10}}>{assigneeName}</span>}
                          </span>
                        ) : (
                          <span style={{fontSize:10,color:"#94a3b8",fontStyle:"italic"}}>—</span>
                        )}
                        {task.estimate!=null && <span className="tabular" style={{fontSize:10,color:isDone?"#065f46":"#475569",fontWeight:500,lineHeight:1,marginLeft:"auto"}}>{task.estimate}h</span>}
                      </span>
                    </button>
                    </div>;
                  })}
                  {dragId && ghostDate && lane.tasks.some((t:Task)=>t.id===dragId) && (()=>{
                    const dragTask=(state?.tasks as Task[]|undefined)?.find((t:Task)=>t.id===dragId);
                    if(!dragTask || !dragTask.startDate || !dragTask.dueDate) return null;
                    const span=Math.max(0,(Date.parse(`${dragTask.dueDate}T00:00:00Z`)-Date.parse(`${dragTask.startDate}T00:00:00Z`))/86400000);
                    const ghostEnd=addDaysToDate(ghostDate, span);
                    const g=barGeometry({...dragTask, startDate:ghostDate, dueDate:ghostEnd} as Task, win.start, zoom);
                    if(!g) return null;
                    const rowGhost=lane.rowOf.get(dragId) ?? 0;
                    const topGhost=ROW_TOP+rowGhost*ROW_H;
                    return <div aria-hidden="true" style={{position:"absolute",left:g.left,top:topGhost,width:g.width,height:BAR_H,border:"2px dashed var(--accent)",background:"rgba(52,195,142,0.18)",borderRadius:"var(--radius-card)",pointerEvents:"none",opacity:1,boxShadow:"0 2px 8px rgba(0,0,0,0.18)"}} />;
                  })()}
                </div>
              })}
            </div>
          </div>
      </div>
    </div>
  );
}
