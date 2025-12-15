import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ComposedChart, Bar, Line 
} from 'recharts';
import { 
  Scale, Heart, Zap, Activity, MessageSquare, 
  Trophy, Flame, Timer
} from 'lucide-react';

// --- CONFIGURACIÓN ---
// ¡PEGA AQUÍ TU ENLACE!
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQT2VlO6DOSyVSKjDYMHALcg9UgHQyRSFZ-SJFJqh_1_VQ51Ul4_NEUagRLAi9xj5C8hHcC2NPQ0L1K/pub?output=tsv"; 

// OBJETIVOS
const TARGET_DATE = "2026-04-26"; 
const TARGET_WEIGHT = 72.0;       
const TARGET_EF = 1.62;           
const TARGET_TIME_MINUTES = 195;  

// --- UTILS ---
const daysUntil = (dateStr) => {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const predictTime = (currentEF) => {
  if (!currentEF || currentEF < 1.0) return "---";
  const ratio = TARGET_EF / currentEF;
  const predictedMinutes = TARGET_TIME_MINUTES * Math.pow(ratio, 1.1); 
  const h = Math.floor(predictedMinutes / 60);
  const m = Math.floor(predictedMinutes % 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

// --- COMPONENTES VISUALES ROBUSTOS (Colores Incrustados) ---

const StatCard = ({ title, value, unit, icon: Icon, theme, subtext, progress }) => {
  // Definimos los temas con códigos de color explícitos para no depender de tailwind.config
  const themes = {
    blue:   { text: "text-[#00f2ff]", border: "border-[#00f2ff]", bg: "bg-[#00f2ff]" }, // Cyan Neón
    green:  { text: "text-[#00ff9d]", border: "border-[#00ff9d]", bg: "bg-[#00ff9d]" }, // Verde Neón
    red:    { text: "text-[#ff0055]", border: "border-[#ff0055]", bg: "bg-[#ff0055]" }, // Rojo Neón
    amber:  { text: "text-[#ffb700]", border: "border-[#ffb700]", bg: "bg-[#ffb700]" }, // Ambar Neón
    purple: { text: "text-[#d946ef]", border: "border-[#d946ef]", bg: "bg-[#d946ef]" }, // Púrpura
  };

  const activeTheme = themes[theme] || themes.blue;

  return (
    <div className="relative overflow-hidden bg-[#151621] border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-all duration-300">
      {/* Icono de fondo marca de agua */}
      <div className={`absolute top-0 right-0 p-2 opacity-10 ${activeTheme.text}`}>
          <Icon size={40} />
      </div>
      
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-slate-400" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</h3>
      </div>
      
      <div className="relative z-10">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-mono font-bold text-white tracking-tighter shadow-black drop-shadow-md">
            {value}
          </span>
          <span className="text-[10px] font-bold text-slate-500 uppercase">{unit}</span>
        </div>
        
        {/* Barra de Progreso - Ahora usamos style directo para asegurar el color */}
        {progress !== undefined && (
          <div className="w-full h-1.5 bg-[#0b0c15] rounded-full mt-3 overflow-hidden border border-slate-800">
            <div 
              className={`h-full transition-all duration-1000 ${activeTheme.bg}`} 
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
        
        {subtext && <p className={`text-[10px] mt-2 font-mono opacity-80 ${activeTheme.text}`}>{subtext}</p>}
      </div>
    </div>
  );
};

const MisterMessage = ({ message }) => {
  if (!message) return null;
  const msgLower = message.toLowerCase();
  
  // Lógica directa de colores
  let styles = { borderColor: "#64748b", color: "#cbd5e1", shadow: "none" }; // Default

  if (msgLower.match(/bien|cojonudo|sigue|perfecto|vamos/)) {
    styles = { borderColor: "#00ff9d", color: "#00ff9d", shadow: "0 0 30px rgba(0,255,157,0.15)" };
  } else if (msgLower.match(/cuidado|ojo|aviso|atento|vigila/)) {
    styles = { borderColor: "#ffb700", color: "#ffb700", shadow: "0 0 30px rgba(255,183,0,0.15)" };
  } else if (msgLower.match(/mal|parar|freno|dolor|lesion|stop/)) {
    styles = { borderColor: "#ff0055", color: "#ff0055", shadow: "0 0 30px rgba(255,0,85,0.2)" };
  }

  return (
    <div 
      className="mt-8 relative bg-[#151621] border-l-4 rounded-r-xl p-6 transition-all"
      style={{ borderColor: styles.borderColor, boxShadow: styles.shadow }}
    >
      <div className="flex items-center gap-3 mb-2">
        <MessageSquare size={16} style={{ color: styles.color }} />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Feedback Técnico</h3>
      </div>
      <p 
        className="text-xl md:text-2xl font-mono font-bold italic leading-snug"
        style={{ color: styles.color }}
      >
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

  const parseNumber = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleanStr = String(val).replace(',', '.').trim(); 
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

  if (loading) return <div className="h-screen bg-[#0b0c15] flex items-center justify-center text-[#00f2ff] font-mono text-xs animate-pulse">SINCRONIZANDO TELEMETRÍA...</div>;
  if (error) return <div className="h-screen bg-[#0b0c15] flex items-center justify-center text-[#ff0055] font-mono">{error}</div>;

  const last = data[data.length - 1] || {};
  
  // Semáforos Lógicos
  const isRhrGood = last.FC_Reposo < 45;
  const isSoleusGood = last.GCT_Balance_Izq >= 49.0;
  
  // Progresos
  const daysLeft = daysUntil(TARGET_DATE);
  const predictedTime = predictTime(last.Eficiencia_EF);
  const startWeight = 78.0; 
  const weightProgress = ((startWeight - last.Peso) / (startWeight - TARGET_WEIGHT)) * 100;
  const efProgress = ((last.Eficiencia_EF - 1.30) / (TARGET_EF - 1.30)) * 100;

  // Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#151621]/90 backdrop-blur border border-slate-700 p-3 rounded text-xs shadow-xl font-mono">
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
    // FONDO FORZADO AQUÍ (bg-[#0b0c15])
    <div className="min-h-screen bg-[#0b0c15] text-slate-200 font-sans selection:bg-[#00f2ff] selection:text-black pb-20">
      
      {/* HEADER & COUNTDOWN */}
      <div className="border-b border-slate-800 bg-[#0b0c15]/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto p-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white italic leading-none">
              MANOLITO <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#00ff9d]">3:15</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-1">SISTEMA MAPOMA '26</p>
          </div>
          
          <div className="flex gap-2">
             <div className="bg-[#151621] border border-slate-800 rounded px-4 py-2 text-center min-w-[100px]">
                <div className="text-[10px] text-slate-500 font-bold">RACE DAY</div>
                <div className="text-2xl font-mono font-bold text-white">{daysLeft}</div>
             </div>
             <div className="bg-[#151621] border border-slate-800 rounded px-4 py-2 text-center min-w-[120px]">
                <div className="text-[10px] text-slate-500 font-bold">PREDICCIÓN</div>
                <div className="text-2xl font-mono font-bold text-white">{predictedTime}</div>
             </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* KPI DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Peso Actual" value={last.Peso} unit="kg" icon={Scale} 
            theme="blue"
            subtext={`Meta: ${TARGET_WEIGHT}kg`}
            progress={weightProgress} 
          />
          <StatCard 
            title="FC Reposo" value={last.FC_Reposo} unit="ppm" icon={Heart} 
            theme={isRhrGood ? "green" : "amber"}
            subtext={isRhrGood ? "Bradicardia OK" : "Vigilar fatiga"}
          />
          <StatCard 
            title="Eficiencia (EF)" value={last.Eficiencia_EF} unit="pts" icon={Zap} 
            theme="purple"
            subtext={`Meta: ${TARGET_EF} pts`}
            progress={efProgress}
          />
          <StatCard 
            title="Sóleo (GCT)" value={last.GCT_Balance_Izq} unit="%" icon={Activity} 
            theme={isSoleusGood ? "green" : "red"}
            subtext={isSoleusGood ? "Simetría OK" : "Descompensado"}
          />
        </div>

        <MisterMessage message={last.Mensaje_Mister} />

        {/* CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* GRÁFICA 1 */}
          <div className="bg-[#151621] border border-slate-800 rounded-xl p-6">
            <h3 className="text-slate-400 text-xs font-bold uppercase mb-6 flex items-center gap-2">
              <Zap size={14} className="text-[#00f2ff]"/> Eficiencia
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
                  <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Eficiencia_EF" stroke="#00f2ff" strokeWidth={2} fillOpacity={1} fill="url(#colorEf)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICA 2 */}
          <div className="bg-[#151621] border border-slate-800 rounded-xl p-6">
            <h3 className="text-slate-400 text-xs font-bold uppercase mb-6 flex items-center gap-2">
              <Trophy size={14} className="text-[#00ff9d]"/> Carga vs Pulso
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} vertical={false} />
                  <XAxis dataKey="Fecha" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickMargin={10}/>
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false}/>
                  <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false}/>
                  <Tooltip content={<CustomTooltip />} />
                  <Bar yAxisId="left" dataKey="Distancia" fill="#334155" radius={[2, 2, 0, 0]} barSize={12} />
                  <Line yAxisId="right" type="monotone" dataKey="FC_Media" stroke="#ff0055" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}