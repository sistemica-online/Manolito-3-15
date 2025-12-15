import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ComposedChart, Bar, Legend 
} from 'recharts';
import { 
  Activity, Heart, Zap, Scale, TrendingUp, MessageSquare, Timer, AlertTriangle 
} from 'lucide-react';

// --- CONFIGURACIÓN ---
// ¡IMPORTANTE! Pega aquí tu nuevo enlace que termina en output=tsv
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQT2VlO6DOSyVSKjDYMHALcg9UgHQyRSFZ-SJFJqh_1_VQ51Ul4_NEUagRLAi9xj5C8hHcC2NPQ0L1K/pub?output=tsv"; 

// --- COMPONENTES UI ---
const Card = ({ title, value, unit, icon: Icon, trendColor, subtext, borderColor = "border-slate-700" }) => (
  <div className={`bg-slate-800 p-4 rounded-lg border-l-4 ${borderColor} shadow-lg`}>
    <div className="flex justify-between items-start mb-2">
      <h3 className="text-slate-400 text-xs uppercase tracking-wider font-bold">{title}</h3>
      <Icon size={18} className="text-slate-500" />
    </div>
    <div className="flex items-baseline gap-1">
      <span className={`text-2xl font-mono font-bold ${trendColor || 'text-slate-200'}`}>{value}</span>
      <span className="text-xs text-slate-500">{unit}</span>
    </div>
    {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
  </div>
);

const MisterFeedback = ({ message }) => {
  if (!message) return null;
  const msgLower = message.toLowerCase();
  
  let styles = "border-slate-500 bg-slate-800 text-slate-300";
  if (msgLower.match(/bien|cojonudo|sigue|perfecto|vamos/)) {
    styles = "border-emerald-500 bg-emerald-900/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
  } else if (msgLower.match(/cuidado|ojo|aviso|atento|vigila/)) {
    styles = "border-amber-500 bg-amber-900/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]";
  } else if (msgLower.match(/mal|parar|freno|dolor|lesion|stop/)) {
    styles = "border-rose-500 bg-rose-900/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]";
  }

  return (
    <div className={`mt-6 p-4 border rounded-lg ${styles} transition-all`}>
      <div className="flex items-center gap-3 mb-1">
        <MessageSquare size={18} />
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-80">Mensaje del Míster</h3>
      </div>
      <p className="text-lg font-medium italic">"{message}"</p>
    </div>
  );
};

// --- LOGICA PRINCIPAL ---
export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper ULTRA ROBUSTO para números
  const parseNumber = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    // Convierte comas a puntos y elimina espacios extraños
    const cleanStr = String(val).replace(',', '.').trim();
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  useEffect(() => {
    if (SHEET_URL.includes("PEGA_AQUI")) {
        console.warn("URL no configurada");
        setLoading(false); 
        return;
    }

    Papa.parse(SHEET_URL, {
      download: true,
      header: true,
      delimiter: '\t', // <--- CLAVE: Forzamos lectura por tabuladores (TSV)
      skipEmptyLines: true,
      complete: (results) => {
        try {
          console.log("Datos crudos recibidos:", results.data); // Para depurar en consola si hace falta
          
          const cleanData = results.data.map((row, index) => ({
            id: index,
            Fecha: row.Fecha || "N/A",
            Peso: parseNumber(row.Peso),
            FC_Reposo: parseNumber(row.FC_Reposo), // ParseNumber también aquí por si acaso
            Tipo_Sesion: row.Tipo_Sesion || "Descanso",
            Distancia: parseNumber(row.Distancia),
            Ritmo_Medio: row.Ritmo_Medio || "0:00",
            FC_Media: parseNumber(row.FC_Media),
            Watios_Medios: parseNumber(row.Watios_Medios),
            Eficiencia_EF: parseNumber(row.Eficiencia_EF),
            GCT_Balance_Izq: parseNumber(row.GCT_Balance_Izq) || 50.0,
            Sensaciones: parseNumber(row.Sensaciones),
            Mensaje_Mister: row.Mensaje_Mister || ""
          }));
          
          setData(cleanData);
          setLoading(false);
        } catch (err) {
          setError("Error procesando datos: " + err.message);
          setLoading(false);
        }
      },
      error: (err) => {
        setError("Error de conexión: " + err.message);
        setLoading(false);
      }
    });
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center text-cyan-400 animate-pulse">Sincronizando Satélite...</div>;
  if (error) return <div className="h-screen flex items-center justify-center text-rose-500 font-bold">{error}</div>;

  if (data.length === 0) return (
    <div className="h-screen flex flex-col items-center justify-center text-slate-400 gap-4">
      <AlertTriangle size={48} className="text-amber-500"/>
      <p>No llegan datos. Revisa que el enlace sea TSV.</p>
    </div>
  );

  const lastSession = data[data.length - 1];
  const isRhrGood = lastSession.FC_Reposo < 45;
  const isSoleusGood = lastSession.GCT_Balance_Izq >= 49.0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-xs">
          <p className="font-bold text-slate-300 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: <span className="font-mono">{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="text-cyan-500" />
              MANOLITO <span className="text-cyan-500">3:15</span> CS
            </h1>
            <p className="text-slate-500 text-sm mt-1">SISTEMA DE CONTROL DE RENDIMIENTO</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-full">
             <span className={`w-3 h-3 rounded-full ${isRhrGood ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span className="text-xs font-mono text-slate-300">ESTADO: {isRhrGood ? 'ÓPTIMO' : 'VIGILAR'}</span>
          </div>
        </header>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title="Peso Actual" value={lastSession.Peso} unit="kg" icon={Scale} borderColor="border-slate-600" />
          <Card title="FC Reposo" value={lastSession.FC_Reposo} unit="ppm" icon={Heart} 
            trendColor={isRhrGood ? "text-emerald-400" : "text-amber-400"}
            borderColor={isRhrGood ? "border-emerald-500" : "border-amber-500"}
            subtext={isRhrGood ? "Bradicardia OK" : "Recuperación pendiente"} />
          <Card title="Eficiencia (EF)" value={lastSession.Eficiencia_EF} unit="pts" icon={Zap} trendColor="text-cyan-400" borderColor="border-cyan-500" subtext="Ratio Watios/FC" />
          <Card title="Salud Sóleo (GCT L)" value={lastSession.GCT_Balance_Izq} unit="%" icon={TrendingUp} 
            trendColor={isSoleusGood ? "text-emerald-400" : "text-rose-400"}
            borderColor={isSoleusGood ? "border-emerald-500" : "border-rose-500"}
            subtext={isSoleusGood ? "Simetría correcta" : "Descompensación"} />
        </div>

        <MisterFeedback message={lastSession.Mensaje_Mister} />

        {/* GRÁFICAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
            <h3 className="text-slate-400 text-sm font-bold uppercase mb-4 flex gap-2"><Zap size={16}/> Evolución Eficiencia</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="Fecha" stroke="#64748b" fontSize={12} tickLine={false}/>
                  <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={12} tickLine={false}/>
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Eficiencia_EF" stroke="#06b6d4" strokeWidth={3} dot={{r:4, fill:'#06b6d4'}} activeDot={{r:6, stroke:'#fff'}} name="Eficiencia" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
            <h3 className="text-slate-400 text-sm font-bold uppercase mb-4 flex gap-2"><Timer size={16}/> Volumen vs Pulso</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="Fecha" stroke="#64748b" fontSize={12} tickLine={false}/>
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} label={{ value: 'km', angle: -90, position: 'insideLeft', fill: '#64748b' }}/>
                  <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#64748b" fontSize={12} tickLine={false} label={{ value: 'bpm', angle: 90, position: 'insideRight', fill: '#64748b' }}/>
                  <Tooltip content={<CustomTooltip />} />
                  <Bar yAxisId="left" dataKey="Distancia" fill="#475569" radius={[4, 4, 0, 0]} barSize={20} name="Distancia" />
                  <Line yAxisId="right" type="monotone" dataKey="FC_Media" stroke="#f43f5e" strokeWidth={2} dot={false} name="FC Media" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}