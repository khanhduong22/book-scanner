'use client';

import { useState, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import Tesseract from "tesseract.js";

export default function Home() {
  const [books, setBooks] = useState<Array<{
    title: string;
    authors: string[];
    publishedDate: string;
    coverImage: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  async function handleImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);

    // OCR
    const { data: { text } } = await Tesseract.recognize(file, 'eng');
    const query = encodeURIComponent(text.trim());

    // Google Books API
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${query}`);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const info = data.items[0].volumeInfo;
      const book = {
        title: info.title,
        authors: info.authors || [],
        publishedDate: info.publishedDate || "",
        coverImage: info.imageLinks?.thumbnail || "",
      };
      await addDoc(collection(db, "scanned_books"), book);
      setBooks(b => [book, ...b]);
    }
    setLoading(false);
  }

  async function startCamera() {
    setShowCamera(true);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    }
  }

  async function capturePhoto() {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            await handleImage({ target: { files: [new File([blob], "capture.jpg", { type: blob.type })] } } as any);
          }
        }, "image/jpeg");
      }
    }
    stopCamera();
  }

  function stopCamera() {
    setShowCamera(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Book Scanner</h1>
      <div className="mb-4 flex gap-4 flex-wrap">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImage}
        />
        <button
          type="button"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={startCamera}
        >
          Take a Picture
        </button>
      </div>
      {showCamera && (
        <div className="mb-4 flex flex-col items-center gap-2">
          <video ref={videoRef} className="w-full max-w-xs border" autoPlay playsInline />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              onClick={capturePhoto}
            >
              Capture
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
              onClick={stopCamera}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {loading && <p>Processing image...</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {books.map((book, i) => (
          <div key={i} className="border p-4 rounded">
            {book.coverImage && <img src={book.coverImage} alt={book.title} className="mb-2" />}
            <h2 className="font-bold">{book.title}</h2>
            <p>Authors: {book.authors.join(", ")}</p>
            <p>Published: {book.publishedDate}</p>
          </div>
        ))}
      </div>
    </main>
  );
}