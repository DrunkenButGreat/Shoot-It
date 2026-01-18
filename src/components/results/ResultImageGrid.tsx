'use client';

import { useI18n } from '@/components/I18nProvider';
import { Download, Trash2, CheckCircle2, Circle, Eye } from 'lucide-react';
import { useState } from 'react';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

type ResultFile = {
  id: string;
  filename: string;
  path: string;
  thumbnail: string | null;
};

export function ResultImageGrid({
  images,
  selectedIds,
  onToggleSelect,
  onDelete,
  showDelete = true,
}: {
  images: ResultFile[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  showDelete?: boolean;
}) {
  const [index, setIndex] = useState(-1);

  return (
    <div className="py-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {images.map((image, i) => (
          <ResultFileCard
            key={image.id}
            image={image}
            isSelected={selectedIds.has(image.id)}
            onToggleSelect={() => onToggleSelect(image.id)}
            onDelete={() => onDelete(image.id)}
            onView={() => setIndex(i)}
            showDelete={showDelete}
          />
        ))}
      </div>

      <Lightbox
        index={index}
        open={index >= 0}
        close={() => setIndex(-1)}
        slides={images.map(img => ({ src: img.path, title: img.filename }))}
      />
    </div>
  );
}

function ResultFileCard({
  image,
  isSelected,
  onToggleSelect,
  onDelete,
  onView,
  showDelete,
}: {
  image: ResultFile;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onView: () => void;
  showDelete: boolean;
}) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (window.confirm(t('common.deleteConfirm'))) {
        setIsDeleting(true);
        try {
            onDelete();
        } finally {
            setIsDeleting(false);
        }
    }
  };

  return (
    <div 
        className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent bg-gray-50 hover:border-gray-200'}`}
        onClick={onToggleSelect}
    >
      <div className="aspect-square relative flex items-center justify-center bg-gray-100/50">
        <img
          src={image.path}
          alt={image.filename}
          className="w-full h-full object-cover select-none"
          loading="lazy"
        />
        
        {/* Checkbox overlay always visible or on hover */}
        <div 
          className={`absolute top-2 left-2 p-1 rounded-full transition-colors z-10 ${isSelected ? 'bg-primary text-white' : 'bg-black/20 text-white opacity-0 group-hover:opacity-100 hover:bg-black/40'}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
        >
          {isSelected ? <CheckCircle2 className="w-5 h-5 shadow-sm" /> : <Circle className="w-5 h-5 shadow-sm" />}
        </div>

        {/* Action Buttons overlay visible on hover */}
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-0">
          <button
            className="p-2.5 bg-white text-gray-700 rounded-xl hover:text-primary hover:scale-105 transition-all shadow-xl"
            title={t('results.viewImage')}
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
          >
            <Eye className="w-5 h-5" />
          </button>
          <a
            href={image.path}
            download={image.filename}
            className="p-2.5 bg-white text-gray-700 rounded-xl hover:text-primary hover:scale-105 transition-all shadow-xl"
            title={t('results.downloadImage')}
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-5 h-5" />
          </a>
          {showDelete && (
            <button
                className="p-2.5 bg-white text-gray-700 rounded-xl hover:text-red-600 hover:scale-105 transition-all shadow-xl"
                onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                }}
                disabled={isDeleting}
                title={t('common.delete')}
            >
                <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      <div className="p-2.5 bg-white border-t border-gray-100">
        <p className="text-[11px] font-medium text-gray-600 truncate text-center" title={image.filename}>
          {image.filename}
        </p>
      </div>
    </div>
  );
}
