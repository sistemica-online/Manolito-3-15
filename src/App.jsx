import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ComposedChart, Bar, Line 
} from 'recharts';
import { 
  Activity, Heart, Zap, Scale, TrendingUp, MessageSquare, Trophy, 
  Calendar, ArrowRight, AlertTriangle, ChevronsUp 
} from 'lucide-react';

// --- ⚙️ CONFIGURACIÓN DEL DIRECTOR DE CARRERA ---
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQT2VlO6DOSyVSKjDYMHALcg9UgHQyRSFZ-SJFJqh_1_VQ51Ul4_NEUagRLAi9xj5C8hHcC2NPQ0L1K/pub?output=tsv"; 

// OBJETIVOS MANOLITO MAPOMA 2026
const TARGET_DATE = "2026-04-26"; // Maratón de Madrid
const TARGET_WEIGHT = 72.0;       // Objetivo agresivo para 1.87m
const TARGET_EF = 1.62;           // Eficiencia necesaria para 3:15 en Madrid
const TARGET_TIME_MINUTES = 195;  // 3h 15m en minutos

// --- UTILS ---
const daysUntil = (dateStr) => {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Algoritmo "El Oráculo": Predicción basada en Eficiencia actual
const predictTime = (currentEF) => {
  if (!currentEF || currentEF < 1.0) return "---";
  
  // Fórmula: Si con EF 1.62 hacemos 195 min (3:15), con EF actual...
  // Ajuste no lineal: Cuanto menor es la EF, más exponencialmente cae el tiempo
  const ratio = TARGET_EF / currentEF;
  const predictedMinutes = TARGET_TIME_MINUTES * Math.pow(ratio, 1.1); 

  const h = Math.floor(predictedMinutes / 60);
  const m = Math.floor(predictedMinutes % 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

// --- COMPONENTES VISUALES ---

const StatCard = ({ title, value, unit, icon: Icon, color, subtext, progress }) => (
  <div className="group relative overflow-hidden bg-race-card border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-all duration-300">
    <div className={`absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
        <Icon size={40} />
    </div>
    
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className={color.replace('text-', 'text-slate-400 ')} />
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</h3>
    </div>
    
    <div className="relative z-10">
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-mono font-bold text-white tracking-tighter shadow-black drop-shadow-md">
          {value}
        </span>
        <span className="text-[10px] font-bold text-slate-500 uppercase">{unit}</span>
      </div>
      
      {/* Barra de Progreso Mini */}
      {progress !== undefined && (
        <div className="w-full h-1.5 bg-slate-900 rounded-full mt-3 overflow-hidden border border-slate-800">
          <div 
            className={`h-full ${color.replace('text-', 'bg-')} transition-all duration-1000`} 
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      
      {subtext && <p className="text-[10px] mt-2 text-slate-400 font-mono">{subtext}</p>}
    </div>
  </div>
);

const MisterMessage = ({ message }) => {
  if (!message) return null;
  const msgLower = message.toLowerCase();
  
  let theme = { border: "border-slate-600", text: "text-slate-300", glow: "" };

  if (msgLower.match(/bien|cojonudo|sigue|perfecto|vamos/)) {
    theme = { border: "border-neon-green", text: "text-neon-green", glow: "shadow-[0_0_30px_rgba(0,255,157,0.1)]" };
  } else if (msgLower.match(/cuidado|ojo|aviso|atento|vigila/)) {
    theme = { border: "border-neon-amber", text: "text-neon-amber", glow: "shadow-[0_0_30px_rgba(255,183,0,0.1)]" };
  } else if (msgLower.match(/mal|parar|freno|dolor|lesion|stop/)) {
    theme = { border: "border-neon-red", text: "text-neon-red", glow: "shadow-[0_0_30px_rgba(255,0,85,0.15)]" };
  }

  return (
    <div className={`mt-8 relative bg-race-card border-l-4 ${theme.border} rounded-r-xl p-6 ${theme.glow} transition-all`}>
      <div className="flex items-center gap-3 mb-2">
        <MessageSquare size={16} className={theme.text} />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Feedback Técnico</h3>
      </div>
      <p className={`text-xl md:text-2xl font-mono font-bold italic ${theme.text} leading-snug`}>
        "{message}"
      </p>
    </div>
  );
};

// --- LOGICA PRINCIPAL ---
export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Parseador Robustus Maximus (Versión TSV + Comas)
  const parseNumber = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleanStr = String(val).replace(',', '.').trim(); // Coma a punto
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  useEffect(() => {
    if (SHEET_URL.includes("PEGA_AQUI")) {
        console.warn("URL no configurada");
        setLoading(false); return;
    }

    Papa.parse(SHEET_URL, {
      download: true, header: true, delimiter: '\t', skipEmptyLines: true,
      complete: (results) => {
        try {
          const cleanData = results.data.map((row, index) => ({
            id: index,
            Fecha: row.Fecha || "N/A",
            Peso: parseNumber(row.Peso),
            FC_Reposo: parseNumber(row.FC_Reposo),
            Tipo_Sesion: row.Tipo_Sesion || "Descanso",
            Distancia: parseNumber(row.Distancia),
            FC_Media: parseNumber(row.FC_Media),
            Eficiencia_EF: parseNumber(row.Eficiencia_EF),
            GCT_Balance_Izq: parseNumber(row.GCT_Balance_Izq) || 50.0,
            Mensaje_Mister: row.Mensaje_Mister || ""
          }));
          setData(cleanData); setLoading(false);
        } catch (err) { setError("Error datos: " + err.message); setLoading(false); }
      },
      error: (err) => { setError("Error conexión: " + err.message); setLoading(false); }
    });
  }, []);

  if (loading) return <div className="h-screen bg-race-dark flex items-center justify-center text-neon-blue font-mono text-xs animate-pulse">SINCRONIZANDO TELEMETRÍA...</div>;
  if (error) return <div className="h-screen bg-race-dark flex items-center justify-center text-neon-red font-mono">{error}</div>;

  // --- CÁLCULOS DEL DASHBOARD ---
  const last = data[data.length - 1] || {};
  
  // KPIs
  const isRhrGood = last.FC_Reposo < 45;
  const isSoleusGood = last.GCT_Balance_Izq >= 49.0;
  
  // Cuenta atrás
  const daysLeft = daysUntil(TARGET_DATE);
  
  // Predicción Tiempo
  const predictedTime = predictTime(last.Eficiencia_EF);
  
  // Progreso Peso (Lógica: Inicio aprox 78kg -> Meta 72kg. Rango 6kg)
  // Calculamos el % de cercanía a 72kg desde 78kg (base arbitraria de inicio de temporada)
  const startWeight = 78.0; 
  const weightDiffTotal = startWeight - TARGET_WEIGHT; // 6kg a perder
  const weightDiffCurrent = startWeight - last.Peso;   // Lo que llevamos perdido
  const weightProgress = (weightDiffCurrent / weightDiffTotal) * 100;

  // Progreso EF (Lógica: Base 1.30 -> Meta 1.62)
  const efProgress = ((last.Eficiencia_EF - 1.30) / (TARGET_EF - 1.30)) * 100;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-race-card/90 backdrop-blur border border-slate-700 p-3 rounded text-xs shadow-xl font-mono">
          <p className="text-slate-400 mb-2 border-b border-slate-700 pb-1">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1 text-slate-200">
                <span>{entry.name}:</span>
                <span className="font-bold text-white">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-race-dark text-slate-200 font-sans selection:bg-neon-blue selection:text-black pb-20">
      
      {/* BACKGROUND GRID */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#151621_1px,transparent_1px),linear-gradient(to_bottom,#151621_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* HEADER & COUNTDOWN */}
        <header className="flex flex-col md:flex-row justify-between items-end border-b border-slate-800 pb-8 gap-6">
          <div className="w-full md:w-auto">
            <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-neon-blue/10 text-neon-blue text-[10px] font-mono font-bold border border-neon-blue/20">MADRID '26</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1">
                   <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse"></span> SYSTEM ONLINE
                </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white italic leading-none">
              MANOLITO <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-green">3:15</span>
            </h1>
          </div>
          
          <div className="flex items-stretch gap-3 w-full md:w-auto">
             {/* WIDGET CUENTA ATRÁS */}
             <div className="flex-1 md:flex-none bg-race-card border border-slate-800 rounded-lg p-4 text-center min-w-[110px] shadow-neon">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">RACE DAY</div>
                <div className="text-3xl font-mono font-bold text-white leading-none">{daysLeft}</div>
                <div className="text-[10px] text-neon-blue font-bold mt-1">DÍAS</div>
             </div>
             
             {/* WIDGET ORÁCULO */}
             <div className="flex-1 md:flex-none bg-race-card border border-slate-800 rounded-lg p-4 text-center min-w-[130px]">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">PROYECCIÓN</div>
                <div className="text-3xl font-mono font-bold text-white leading-none">{predictedTime}</div>
                <div className="text-[10px] text-slate-400 font-bold mt-1">META ESTIMADA</div>
             </div>
          </div>
        </header>

        {/* KPI DASHBOARD */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Peso Actual" value={last.Peso} unit="kg" icon={Scale} 
            color="text-neon-blue" 
            subtext={`Meta: ${TARGET_WEIGHT}kg (${(last.Peso - TARGET_WEIGHT).toFixed(1)}kg left)`}
            progress={weightProgress} 
          />
          <StatCard 
            title="FC Reposo" value={last.FC_Reposo} unit="ppm" icon={Heart} 
            color={isRhrGood ? "text-neon-green" : "text-neon-amber"}
            subtext={isRhrGood ? "Motor en frío OK" : "Recuperación pendiente"}
          />
          <StatCard 
            title="Eficiencia (EF)" value={last.Eficiencia_EF} unit="pts" icon={Zap} 
            color="text-purple-400" 
            subtext={`Objetivo: ${TARGET_EF} pts`}
            progress={efProgress}
          />
          <StatCard 
            title="Simetría GCT" value={last.GCT_Balance_Izq} unit="%" icon={Activity} 
            color={isSoleusGood ? "text-neon-green" : "text-neon-red"}
            subtext={isSoleusGood ? "Balance Perfecto" : "Descompensación Izq"}
          />
        </div>

        <MisterMessage message={last.Mensaje_Mister} />

        {/* CHARTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          
          {/* GRÁFICA 1: EFICIENCIA */}
          <div className="bg-race-card border border-slate-800 rounded-xl p-6 relative">
            <h3 className="text-slate-400 text-xs font-bold uppercase mb-6 flex items-center gap-2">
              <Zap size={14} className="text-neon-blue"/> Curva de Forma (Eficiencia)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorEf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} vertical={false} />
                  <XAxis dataKey="Fecha" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickMargin={10}/>
                  <YAxis domain={['dataMin - 0.1', 'dataMax + 0.1']} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Eficiencia_EF" stroke="#00f2ff" strokeWidth={2} fillOpacity={1} fill="url(#colorEf)" name="Eficiencia" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICA 2: CARGA */}
          <div className="bg-race-card border border-slate-800 rounded-xl p-6">
            <h3 className="text-slate-400 text-xs font-bold uppercase mb-6 flex items-center gap-2">
              <Trophy size={14} className="text-neon-green"/> Volumen vs Respuesta Cardíaca
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} vertical={false} />
                  <XAxis dataKey="Fecha" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickMargin={10}/>
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false}/>
                  <YAxis yAxisId="right" orientation="right" domain={['dataMin - 10', 'auto']} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false}/>
                  <Tooltip content={<CustomTooltip />} />
                  <Bar yAxisId="left" dataKey="Distancia" fill="#334155" radius={[2, 2, 0, 0]} barSize={12} name="Km" />
                  <Line yAxisId="right" type="monotone" dataKey="FC_Media" stroke="#ff0055" strokeWidth={2} dot={false} name="Pulsaciones" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}