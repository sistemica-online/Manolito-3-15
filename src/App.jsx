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
// 1. Ve a tu Google Sheet -> Archivo -> Compartir -> Publicar en la web.
// 2. Selecciona "Valores separados por comas (.csv)".
// 3. Pega el enlace aquí abajo entre las comillas:
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1yYItBDMh2NHzYK7_N_adFzK9lQsgJ4rQGjbO3CQ1DK8/edit?usp=drive_link"; 

// --- COMPONENTES UI (Kpi Card & Feedback) ---
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
  
  // Lógica de colores del Míster
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

  // Helper para convertir "78,5" o "78.5" a número real 78.5
  const parseNumber = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.replace(',', '.'));
  };

  useEffect(() => {
    // Si no hay URL configurada, no intentamos descargar nada
    if (SHEET_URL === "AQUÍ_TU_URL_DE_GOOGLE_SHEETS_CSV") {
        console.warn("URL de CSV no configurada. Esperando datos...");
        setLoading(false); 
        return;
    }

    Papa.parse(SHEET_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          // Procesado y Limpieza de datos
          const cleanData = results.data.map((row, index) => ({
            id: index, // Clave única para React
            Fecha: row.Fecha || "N/A",
            Peso: parseNumber(row.Peso),
            FC_Reposo: parseInt(row.FC_Reposo) || 0,
            Tipo_Sesion: row.Tipo_Sesion || "Descanso",
            Distancia: parseNumber(row.Distancia),
            Ritmo_Medio: row.Ritmo_Medio || "0:00",
            FC_Media: parseInt(row.FC_Media) || 0,
            Watios_Medios: parseInt(row.Watios_Medios) || 0,
            Eficiencia_EF: parseNumber(row.Eficiencia_EF),
            GCT_Balance_Izq: parseNumber(row.GCT_Balance_Izq) || 50.0,
            Sensaciones: parseInt(row.Sensaciones) || 5,
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
        setError("Error descargando CSV: " + err.message);
        setLoading(false);
      }
    });
  }, []);

  // Renderizado de carga o error
  if (loading) return <div className="h-screen flex items-center justify-center text-cyan-400 animate-pulse">Cargando Telemetría...</div>;
  if (error) return <div className="h-screen flex items-center justify-center text-rose-500 font-bold">{error}</div>;

  // Si no hay datos (URL vacía o sheet vacío)
  if (data.length === 0) return (
    <div className="h-screen flex flex-col items-center justify-center text-slate-400 gap-4">
      <AlertTriangle size={48} className="text-amber-500"/>
      <p>Esperando señal del satélite...</p>
      <p className="text-sm bg-slate-800 p-2 rounded">Edita App.jsx y pon tu SHEET_URL</p>
    </div>
  );

  // Datos de la última sesión (KPIs)
  const lastSession = data[data.length - 1];
  const isRhrGood = lastSession.FC_Reposo < 45;
  const isSoleusGood = lastSession.GCT_Balance_Izq >= 49.0;

  // Tooltip customizado para gráficas
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
          {/* Gráfico EF */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
            <h3 className="text-slate-400 text-sm font-bold uppercase mb-4 flex gap-2"><Zap size={16}/> Evolución Eficiencia</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="Fecha" stroke="#64748b" fontSize={12} tickLine={false}/>
                  <YAxis domain={['dataMin - 0.05', 'dataMax + 0.05']} stroke="#64748b" fontSize={12} tickLine={false}/>
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Eficiencia_EF" stroke="#06b6d4" strokeWidth={3} dot={{r:4, fill:'#06b6d4'}} activeDot={{r:6, stroke:'#fff'}} name="Eficiencia" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico Carga vs Pulso */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
            <h3 className="text-slate-400 text-sm font-bold uppercase mb-4 flex gap-2"><Timer size={16}/> Volumen vs Pulso</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="Fecha" stroke="#64748b" fontSize={12} tickLine={false}/>
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} label={{ value: 'km', angle: -90, position: 'insideLeft', fill: '#64748b' }}/>
                  <YAxis yAxisId="right" orientation="right" domain={['dataMin - 10', 'auto']} stroke="#64748b" fontSize={12} tickLine={false} label={{ value: 'bpm', angle: 90, position: 'insideRight', fill: '#64748b' }}/>
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