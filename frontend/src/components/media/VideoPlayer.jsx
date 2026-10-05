import React from "react";
import { ExternalLink } from "lucide-react";
import { isDirectVideo, youtubeEmbed } from "@/lib/media";

/** YouTube embed or a direct video file, lazily loaded. */
export default function VideoPlayer({ url, title }) {
    const yt = youtubeEmbed(url);
    return (
        <div>
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-black aspect-video">
                {yt ? (
                    <iframe
                        src={yt} title={title || "Property video"} className="w-full h-full" loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                ) : isDirectVideo(url) ? (
                    <video src={url} controls preload="metadata" playsInline className="w-full h-full" aria-label={title || "Property video"} />
                ) : (
                    <div className="w-full h-full grid place-items-center text-white/80 text-sm text-center px-6">
                        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Watch this video <ExternalLink size={14} /></a>
                    </div>
                )}
            </div>
            {title && <h3 className="font-medium text-[var(--navy)] mt-3">{title}</h3>}
        </div>
    );
}
