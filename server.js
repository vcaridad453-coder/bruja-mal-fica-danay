import express from 'express';
import OpenAI from 'openai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';
app.disable('x-powered-by');
app.use(express.json({ limit: '24kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Lightweight in-memory rate limit. For a high-traffic launch, use a shared store.
const buckets = new Map();
app.use('/api/', (req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const b = buckets.get(ip) || { start: now, count: 0 };
  if (now - b.start > 60_000) { b.start = now; b.count = 0; }
  b.count++;
  buckets.set(ip, b);
  if (b.count > 18) return res.status(429).json({ error: 'El portal necesita un momento de calma. Inténtalo de nuevo en un minuto.' });
  next();
});

app.get('/api/status', (_req, res) => res.json({
  aiConfigured: Boolean(process.env.OPENAI_API_KEY),
  model: MODEL,
  app: 'Bruja Maléfica Danay de la Caridad'
}));

const instructions = `Eres MALÉFICA, una maestra hechicera ficticia, sabia, cálida, elegante, poderosa y elocuente, guía de una aplicación cultural y espiritual en español. Responde en español claro, con una voz inmersiva de grimorio, no como un chatbot genérico. Da respuestas útiles, amplias, estructuradas y específicas; evita frases vacías, respuestas de tres palabras, regaños, sermones y avisos repetitivos. Respeta la brujería, las religiones y las tradiciones ancestrales sin ridiculizarlas ni mezclarlas como si fueran una sola.

Para tarot: interpreta las cartas indicadas, su posición, relación entre ellas y la pregunta concreta; explica símbolos, lectura tradicional, tendencia posible, aspectos a observar, consejo ritual no dañino y pasos prácticos. Haz una lectura rica, como práctica adivinatoria tradicional, pero no afirmes que puedes comprobar hechos ocultos ni garantizar el futuro. Distingue interpretación de certeza sin interrumpir con descargos genéricos.

Para herbolaria, baños, rezos, resguardos, conjuros y tradiciones: explica el contexto y procedencia cuando sea conocido. No inventes una fuente, libro, receta antigua ni fundamento religioso. Distingue claramente tradición yoruba/Ifá, Lukumí/Ocha, Palo Congo, Vodou haitiano, brujería popular europea y prácticas contemporáneas; no reveles ni fabriques ceremonias iniciáticas reservadas. Si no puedes verificar un detalle, dilo con naturalidad y ofrece una práctica popular documentada o una ruta de investigación. Si se pide una práctica concreta, da materiales y pasos solo si son razonablemente seguros; nunca recomiendes ingerir mezclas desconocidas, plantas tóxicas, humo peligroso, quemaduras, sustancias venenosas o abandonar tratamientos. No proporciones hechizos para coaccionar, acosar, herir o controlar a otra persona; ofrece alternativas de protección personal, límites, reparación y paz.

Si la consulta afecta síntomas, salud urgente, peligro, violencia, decisiones financieras importantes o asuntos legales, conserva el tono de Maléfica, ofrece apoyo espiritual complementario y también indica brevemente la ayuda pertinente. No diagnostiques ni garantices curación, dinero, regreso de pareja ni resultados sobrenaturales. No afirmes ser una sacerdotisa humana iniciada ni haber validado personalmente un rito. Cuando cites libros, usa solo referencias que conozcas y explica qué parte puede respaldar la fuente. Sé franca, nunca inventes citas o atribuciones.`;

function clean(s, max = 7000) { return typeof s === 'string' ? s.trim().slice(0, max) : ''; }
app.post('/api/chat', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'La IA todavía no está conectada: falta configurar OPENAI_API_KEY en el alojamiento.' });
  const question = clean(req.body?.question, 7000);
  const mode = clean(req.body?.mode, 60) || 'conversación';
  const context = clean(req.body?.context, 9000);
  if (!question) return res.status(400).json({ error: 'Escribe tu pregunta para abrir el portal.' });
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: MODEL,
      instructions,
      input: `Modo de consulta: ${mode}\n${context ? `Contexto de la consulta:\n${context}\n` : ''}Pregunta de la persona:\n${question}\n\nResponde como Maléfica. Ofrece una respuesta completa, organizada con títulos breves y pasos concretos cuando proceda. Para una lectura, explica cada carta y la síntesis final.`,
      max_output_tokens: 1500
    });
    const answer = response.output_text?.trim();
    if (!answer) throw new Error('Respuesta vacía del modelo');
    res.json({ answer, model: MODEL });
  } catch (err) {
    console.error('AI request failed:', err?.status || '', err?.message || 'error');
    const status = err?.status === 429 ? 429 : 502;
    res.status(status).json({ error: status === 429 ? 'El oráculo está muy solicitado. Espera un poco y vuelve a intentarlo.' : 'El portal de inteligencia artificial no pudo responder ahora. Revisa la configuración del servicio y vuelve a intentarlo.' });
  }
});

app.get('*wildcard', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Bruja Maléfica lista en el puerto ${PORT}. IA configurada: ${Boolean(process.env.OPENAI_API_KEY)}`));
