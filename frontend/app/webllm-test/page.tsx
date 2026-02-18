"use client";

import { useState, useEffect } from "react";
import { WebLLMAdapter, isWebGPUAvailable } from "@/lib/webllm-adapter";

export default function WebLLMTestPage() {
  const [status, setStatus] = useState("Checking WebGPU support...");
  const [progress, setProgress] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [llm, setLLM] = useState<WebLLMAdapter | null>(null);

  useEffect(() => {
    // Check WebGPU support
    if (!isWebGPUAvailable) {
      setStatus("❌ WebGPU not supported in your browser");
      return;
    }

    setStatus("✅ WebGPU is available!");

    // Listen for progress events
    const handleProgress = (event: Event) => {
      const customEvent = event as CustomEvent;
      setProgress(customEvent.detail.text || "");
    };

    window.addEventListener("webllm-progress", handleProgress);

    return () => {
      window.removeEventListener("webllm-progress", handleProgress);
    };
  }, []);

  const initializeLLM = async () => {
    setLoading(true);
    setStatus("Initializing WebLLM (downloading model to browser cache)...");

    try {
      const instance = await WebLLMAdapter.getInstance("Qwen2.5-1.5B");
      setLLM(instance);
      setStatus("✅ Model ready! Type a message below.");
    } catch (error) {
      setStatus(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!llm) {
      setStatus("Please initialize the model first");
      return;
    }

    setLoading(true);
    setResponse("");

    try {
      const stream = llm.chatStream("Tell me a very short joke about AI");

      for await (const chunk of stream) {
        setResponse((prev) => prev + chunk);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">WebLLM Test Page</h1>
        <p className="text-gray-400 mb-8">
          Test running LLMs locally in your browser using WebGPU
        </p>

        <div className="space-y-4">
          {/* Status */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Status</h2>
            <p className="text-green-400">{status}</p>
            {progress && (
              <p className="text-blue-400 text-sm mt-2">
                {progress}
              </p>
            )}
          </div>

          {/* System Info */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">System Info</h2>
            <ul className="text-sm space-y-1">
              <li>
                WebGPU: {isWebGPUAvailable ? "✅ Available" : "❌ Not Available"}
              </li>
              <li>Browser: {typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Actions</h2>

            <button
              onClick={initializeLLM}
              disabled={loading || !isWebGPUAvailable || llm !== null}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold mr-4"
            >
              {loading ? "Loading..." : "Initialize Model (Qwen2.5-1.5B)"}
            </button>

            <button
              onClick={sendMessage}
              disabled={loading || !llm}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold"
            >
              {loading ? "Generating..." : "Test Chat"}
            </button>
          </div>

          {/* Response */}
          {response && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-2">Response</h2>
              <p className="text-gray-300 whitespace-pre-wrap">{response}</p>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">ℹ️ About WebLLM</h2>
            <ul className="text-sm space-y-2 list-disc list-inside">
              <li>Models run entirely in your browser using WebGPU</li>
              <li>No server required - completely private and offline-capable</li>
              <li>Models are cached in browser storage (not your C: drive!)</li>
              <li>First load downloads the model (~1-2GB), then it's cached</li>
              <li>Requires a modern browser with WebGPU support (Chrome 113+, Edge 113+)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
