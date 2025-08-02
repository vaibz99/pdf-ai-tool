import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { pipeline } from "@xenova/transformers";
import "pdfjs-dist/web/pdf_viewer.css";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

let activeRenderTask = null;

export default function App() {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1.2);
  const [selectionBox, setSelectionBox] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [question, setQuestion] = useState("");
  const [promptPreview, setPromptPreview] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("groq"); // "groq" or "gemini"
  const [vectorDB, setVectorDB] = useState([]); // { text, embedding }[]
  const [embedder, setEmbedder] = useState(null);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const startPos = useRef(null);
  const textCache = useRef({}); // pageNum -> { items, viewport }

  // Load embedding model once
  useEffect(() => {
    const loadEmbedder = async () => {
      const emb = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      setEmbedder(() => emb);
    };
    loadEmbedder();
  }, []);

  // Build prompt preview dynamically
  useEffect(() => {
    if (!question) {
      setPromptPreview("");
      return;
    }
    const primary = extractedText.trim();
    let preview = "";
    if (primary) {
      preview += `Primary excerpt (highlighted): "${primary}"\n\n`;
    }
    preview += `Question: "${question}"\n\n`;
    preview += `Instruction: Answer using the primary excerpt first. You may use supplementary context from the rest of the document only if the excerpt is insufficient or ambiguous. If the excerpt alone suffices, base the answer on it. If still not enough, respond: 'Not enough information in the document to answer that.'`;
    setPromptPreview(preview);
  }, [extractedText, question]);

  // Load PDF and build vector DB
  async function loadPdf(url) {
    try {
      const loadingTask = pdfjsLib.getDocument({ url });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);

      // Preload all page text and build vector DB
      if (embedder) {
        const allTextArray = [];
        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
          const page = await doc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((i) => i.str).join(" ");
          allTextArray.push(pageText);
        }
        const joined = allTextArray.join(" ");
        const chunks = chunkText(joined, 400);
        const vectorEntries = [];
        for (const chunk of chunks) {
          const emb = await embedder(chunk);
          vectorEntries.push({ text: chunk, embedding: emb.data[0] });
        }
        setVectorDB(vectorEntries);
      }

      await renderPage(1, doc);
    } catch (err) {
      console.error("Failed to load PDF:", err);
    }
  }

  // Render with cancellation safety
  async function renderPage(pageNum, docOverride = null) {
    if (!pdfDoc && !docOverride) return;
    const doc = docOverride || pdfDoc;

    if (activeRenderTask) {
      try {
        activeRenderTask.cancel();
      } catch {}
      activeRenderTask = null;
    }

    const page = await doc.getPage(pageNum);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const viewport = page.getViewport({ scale: zoom });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    activeRenderTask = page.render({ canvasContext: ctx, viewport });
    await activeRenderTask.promise;
    activeRenderTask = null;

    // Cache text for selection logic
    const textContent = await page.getTextContent();
    textCache.current[pageNum] = { items: textContent.items, viewport };
  }

  // Simple chunker based on character length
  function chunkText(text, size) {
    const words = text.split(" ");
    const chunks = [];
    let chunk = [];
    for (let w of words) {
      chunk.push(w);
      if (chunk.join(" ").length >= size) {
        chunks.push(chunk.join(" "));
        chunk = [];
      }
    }
    if (chunk.length) chunks.push(chunk.join(" "));
    return chunks;
  }

  // Selection mouse handling
  function onMouseDown(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    startPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setSelectionBox({ left: startPos.current.x, top: startPos.current.y, width: 0, height: 0 });
  }

  function onMouseMove(e) {
    if (!startPos.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSelectionBox({
      left: Math.min(startPos.current.x, x),
      top: Math.min(startPos.current.y, y),
      width: Math.abs(x - startPos.current.x),
      height: Math.abs(y - startPos.current.y),
    });
  }

  function onMouseUp() {
    if (!startPos.current) return;
    extractFromSelection();
    startPos.current = null;
  }

  // Extract text from selection box with overlap heuristics
  function extractFromSelection() {
    const sel = selectionBox;
    if (!sel || !textCache.current[currentPage]) return;

    const { items, viewport } = textCache.current[currentPage];
    const selectedItems = [];

    items.forEach((item) => {
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const x = tx[4];
      const y = tx[5] - item.height;
      const width = item.width * viewport.scale;
      const height = item.height;
      const overlap = getOverlap(sel, { x, y, width, height });
      const coverage = overlap / (width * height);
      if (coverage >= 0.3) {
        selectedItems.push(item.str);
      }
    });

    setExtractedText(selectedItems.join(" ").trim());
  }

  // Rectangle overlap
  function getOverlap(a, b) {
    const xOverlap = Math.max(0, Math.min(a.left + a.width, b.x + b.width) - Math.max(a.left, b.x));
    const yOverlap = Math.max(0, Math.min(a.top + a.height, b.y + b.height) - Math.max(a.top, b.y));
    return xOverlap * yOverlap;
  }

  // Cosine similarity for semantic search
  function cosineSimilarity(vecA, vecB) {
    const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return magA && magB ? dot / (magA * magB) : 0;
  }

  // Unified ask logic: highlight + supplemental context
  async function handleAsk() {
    if (!question) return;
    setLoading(true);

    const primaryExcerpt = extractedText.trim();
    let supplementaryText = "";

    if (vectorDB.length > 0 && embedder) {
      // Embed question
      const qEmbRes = await embedder(question);
      const qVec = qEmbRes.data[0];

      // Score by question
      const scoredByQuestion = vectorDB.map((e) => ({
        text: e.text,
        score: cosineSimilarity(qVec, e.embedding),
      }));

      let combined = {};
      // Start with question scores
      scoredByQuestion.forEach(({ text, score }) => {
        combined[text] = score;
      });

      // If there's a selection, also score by it and merge (give selection influence)
      if (primaryExcerpt) {
        const selEmbRes = await embedder(primaryExcerpt);
        const selVec = selEmbRes.data[0];
        const scoredBySelection = vectorDB.map((e) => ({
          text: e.text,
          score: cosineSimilarity(selVec, e.embedding),
        }));
        scoredBySelection.forEach(({ text, score }) => {
          combined[text] = Math.max(combined[text] || 0, score * 1.1); // boost selection-related
        });
      }

      const combinedArray = Object.entries(combined).map(([text, score]) => ({ text, score }));
      combinedArray.sort((a, b) => b.score - a.score);

      // Pick top 3 supplements, avoid duplicating the primary excerpt
      const supplements = [];
      for (let entry of combinedArray) {
        if (supplements.length >= 3) break;
        if (primaryExcerpt && entry.text === primaryExcerpt) continue;
        supplements.push(entry.text);
      }
      if (supplements.length) {
        supplementaryText = supplements.join("\n\n");
      }
    }

    // Build prompt
    let prompt = "";
    if (primaryExcerpt) {
      prompt += `Primary excerpt (highlighted):\n"${primaryExcerpt}"\n\n`;
    }
    if (supplementaryText) {
      prompt += `Supplementary relevant context:\n${supplementaryText}\n\n`;
    }
    prompt += `Question: "${question}"\n\n`;
    prompt += `Instruction: Answer using the primary excerpt first. You may use the supplementary context only if the excerpt is insufficient or ambiguous. If the excerpt alone suffices, base the answer on it. If still not enough, respond: 'Not enough information in the document to answer that.'`;

    setPromptPreview(prompt);

    let finalAnswer = "";

    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 500));
      if (primaryExcerpt) {
        finalAnswer = `Based on your highlighted excerpt${supplementaryText ? " plus related context" : ""}: ${primaryExcerpt.slice(0, 120)}...`;
      } else if (supplementaryText) {
        finalAnswer = `Based on relevant parts of the document: ${supplementaryText.slice(0, 120)}...`;
      } else {
        finalAnswer = "Not enough information in the document to answer that.";
      }
    } else if (provider === "groq") {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: prompt },
          ],
          temperature: 0,
          max_tokens: 400,
        }),
      });
      const data = await res.json();
      finalAnswer = data.choices?.[0]?.message?.content || "No response from model.";
    } else if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );
      const data = await res.json();
      finalAnswer = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from model.";
    }

    setAnswer(finalAnswer);
    setLoading(false);
  }

  function clearAll() {
    setSelectionBox(null);
    setExtractedText("");
    setQuestion("");
    setPromptPreview("");
    setAnswer("");
  }

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
      <h2>Unified AI PDF Tool</h2>

      {/* Provider + Key */}
      <div style={{ marginBottom: "0.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <label>Provider: </label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="groq">Groq (LLaMA-3)</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>
        <div>
          <input
            type="password"
            placeholder="API Key (gsk_... or AIza...)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ minWidth: 250 }}
          />
        </div>
        <div>
          <button onClick={() => loadPdf("/sample.pdf")}>Load sample.pdf</button>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const fileURL = URL.createObjectURL(file);
                loadPdf(fileURL);
              }
            }}
          />
        </div>
      </div>

      {/* Navigation & Zoom */}
      <div style={{ marginBottom: "0.5rem" }}>
        <button
          onClick={() => {
            if (currentPage > 1) setCurrentPage((p) => { renderPage(p - 1); return p - 1; });
          }}
        >
          Prev
        </button>
        <span style={{ margin: "0 0.5rem" }}>
          Page {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => {
            if (currentPage < totalPages) setCurrentPage((p) => { renderPage(p + 1); return p + 1; });
          }}
        >
          Next
        </button>
        <button onClick={() => { setZoom((z) => z + 0.2); renderPage(currentPage); }}>Zoom In</button>
        <button onClick={() => { setZoom((z) => Math.max(0.4, z - 0.2)); renderPage(currentPage); }}>Zoom Out</button>
        <button onClick={() => { setZoom(1.2); renderPage(currentPage); }}>Reset Zoom</button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          style={{ border: "1px solid #ccc", cursor: "crosshair" }}
        />
        {selectionBox && (
          <div
            style={{
              position: "absolute",
              left: selectionBox.left,
              top: selectionBox.top,
              width: selectionBox.width,
              height: selectionBox.height,
              border: "2px dashed #2563eb",
              backgroundColor: "rgba(37,99,235,0.1)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Q&A */}
      <div style={{ marginTop: "1rem" }}>
        <div>
          <label>Highlighted excerpt:</label>
          <textarea
            value={extractedText}
            readOnly
            placeholder="Select text on page to anchor answer"
            rows={3}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ marginTop: 4 }}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about the document"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ marginTop: 4 }}>
          <label>Prompt preview:</label>
          <textarea value={promptPreview} readOnly rows={5} style={{ width: "100%" }} />
        </div>
        <div style={{ marginTop: 6, display: "flex", gap: "1rem" }}>
          <button onClick={handleAsk} disabled={loading}>
            {loading ? "Thinking..." : "Ask"}
          </button>
          <button onClick={clearAll}>Clear</button>
        </div>
        <div style={{ marginTop: 8, minHeight: 80, border: "1px solid #ccc", padding: 8 }}>
          {answer || "No answer yet."}
        </div>
      </div>
    </div>
  );
}
