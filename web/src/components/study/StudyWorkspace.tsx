"use client";

import { useState } from "react";
import { ImageViewer, type Overlay, type Pt, type ViewerImage } from "@/components/viewer/ImageViewer";
import { ReviewPanel, type FindingDTO } from "./ReviewPanel";

/** Client shell that shares the editable nodule contour between the viewer and the review form. */
export function StudyWorkspace(props: {
  images: ViewerImage[];
  overlays: Overlay[];
  side: React.ReactNode; // rendered when no editable review is shown (e.g. signed result / analyze CTA)
  review?: { analysisId: string; finding: FindingDTO | null; findingImageId: string | null; aiContour: Pt[] | null };
}) {
  const [contour, setContour] = useState<Pt[] | null>(props.review?.aiContour ?? null);
  const [edited, setEdited] = useState(false);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
      <div className="min-w-0">
        <ImageViewer
          images={props.images}
          // While reviewing, the AI contour is drawn by the editable layer instead
          overlays={props.review ? props.overlays.map((o) => (o.imageId === props.review!.findingImageId ? { ...o, contour: edited ? o.contour : [] } : o)) : props.overlays}
          editableImageId={props.review?.findingImageId ?? undefined}
          editedContour={contour}
          onContourChange={(c) => {
            setContour(c);
            setEdited(true);
          }}
        />
      </div>
      <div className="min-w-0 space-y-6">
        {props.side}
        {props.review && (
          <ReviewPanel
            analysisId={props.review.analysisId}
            finding={props.review.finding}
            contourEdited={edited}
            editedContour={edited ? contour : null}
            onResetContour={() => {
              setContour(props.review!.aiContour);
              setEdited(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
