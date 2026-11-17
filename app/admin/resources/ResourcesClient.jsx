"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";
import { uploadResource, getSignedUrl } from "@/lib/resources/actions";
import {
  formatResourceDateFull,
  formatFileSize,
  getNextVersion,
} from "@/lib/resources/queries";

const RESOURCE_CONFIG = {
  handbook: {
    title: "Employee handbook",
    subtitle: "Policies, attendance and emergencies",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
        <path d="M12 9v6M9 12h6" />
      </svg>
    ),
    color: "#DCE8FB",
  },
  lesson_plans: {
    title: "Lesson plans",
    subtitle: "Youth Wellness curriculum",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
        <path d="M20 4h-6a3 3 0 0 0-3 3M20 4v14h-6" />
      </svg>
    ),
    color: "#E1EEF1",
  },
};

function ResourceCard({ resource, totalInstructors, onUploadSuccess }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [pageCount, setPageCount] = useState(null);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const config = RESOURCE_CONFIG[resource.key] || {
    title: resource.title,
    subtitle: "",
    icon: null,
    color: "#E8EDF6",
  };

  const hasFile = !!resource.file_path;
  const isComingSoon = !hasFile && resource.key !== "handbook";

  // Extract page count from PDF client-side for preview
  const extractPageCountPreview = async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const text = new TextDecoder("latin1").decode(bytes);

      const countMatches = text.match(/\/Count\s+(\d+)/g);
      if (countMatches && countMatches.length > 0) {
        let maxCount = 0;
        for (const match of countMatches) {
          const num = parseInt(match.match(/\d+/)[0], 10);
          if (num > maxCount) maxCount = num;
        }
        if (maxCount > 0) return maxCount;
      }

      const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
      if (pageMatches) return pageMatches.length;

      return null;
    } catch {
      return null;
    }
  };

  const handleFileSelect = async (file) => {
    if (!file) return;

    setError(null);
    setPageCount(null);

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large. Maximum size is 10 MB.");
      return;
    }

    setSelectedFile(file);

    // Extract page count for preview
    const count = await extractPageCountPreview(file);
    setPageCount(count);
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("versionLabel", versionLabel.trim());

    const result = await uploadResource(resource.key, formData);

    if (result.error) {
      setError(result.error);
      setUploading(false);
      return;
    }

    // Success - close modal and refresh
    setShowModal(false);
    setSelectedFile(null);
    setVersionLabel("");
    setPageCount(null);
    setUploading(false);
    onUploadSuccess?.(resource.key, versionLabel.trim());
    router.refresh();
  };

  const openModal = () => {
    // Pre-fill next version
    const nextVersion = getNextVersion(resource.version_label);
    setVersionLabel(nextVersion);
    setSelectedFile(null);
    setPageCount(null);
    setError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedFile(null);
    setVersionLabel("");
    setPageCount(null);
    setError(null);
  };

  const handleViewOldVersion = async (filePath) => {
    const result = await getSignedUrl(filePath);
    if (result.error) {
      alert(result.error);
      return;
    }
    window.open(result.url, "_blank");
  };

  // Parse history
  const historyItems = (resource.history || [])
    .slice(0, 5)
    .map((file) => {
      const match = file.name.match(/^(\d+)-(.+)$/);
      const timestamp = match ? parseInt(match[1], 10) : null;
      const fileName = match ? match[2] : file.name;
      return {
        name: fileName,
        path: `${resource.key}/${file.name}`,
        date: timestamp ? new Date(timestamp) : null,
        isCurrent: resource.file_path === `${resource.key}/${file.name}`,
      };
    })
    .filter((item) => !item.isCurrent);

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon} style={{ backgroundColor: config.color }}>
            {config.icon}
          </div>
          <div className={styles.cardMeta}>
            <h3 className={styles.cardTitle}>{config.title}</h3>
            <p className={styles.cardSubtitle}>{config.subtitle}</p>
          </div>
          {hasFile && (
            <span className={styles.statusPill}>Live</span>
          )}
          {isComingSoon && (
            <span className={styles.comingSoonPill}>Coming soon</span>
          )}
        </div>

        {hasFile && (
          <div className={styles.cardDetails}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Version</span>
              <span className={styles.detailValue}>{resource.version_label || "—"}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Updated</span>
              <span className={styles.detailValue}>{formatResourceDateFull(resource.updated_at)}</span>
            </div>
            {resource.file_name && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>File</span>
                <span className={styles.detailValue}>
                  {resource.file_name}
                  {resource.file_size && ` · ${formatFileSize(resource.file_size)}`}
                  {resource.page_count && ` · ${resource.page_count} pages`}
                </span>
              </div>
            )}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Opened by</span>
              <span className={styles.detailValue}>
                {resource.openCount} of {totalInstructors} instructors
              </span>
            </div>
          </div>
        )}

        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.uploadBtn}
            onClick={openModal}
          >
            {hasFile ? "Upload new version" : "Upload"}
          </button>
          {hasFile && (
            <Link
              href={`/instructor/resources/${resource.key}`}
              target="_blank"
              className={styles.viewBtn}
            >
              View current
            </Link>
          )}
        </div>

        {historyItems.length > 0 && (
          <div className={styles.history}>
            <button
              type="button"
              className={styles.historyToggle}
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? "Hide" : "Show"} previous versions ({historyItems.length})
            </button>

            {showHistory && (
              <div className={styles.historyList}>
                {historyItems.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    className={styles.historyItem}
                    onClick={() => handleViewOldVersion(item.path)}
                  >
                    <span className={styles.historyName}>{item.name}</span>
                    {item.date && (
                      <span className={styles.historyDate}>
                        {formatResourceDateFull(item.date)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Upload {config.title}</h2>
              <button type="button" className={styles.closeBtn} onClick={closeModal}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div
                ref={dropZoneRef}
                className={`${styles.dropZone} ${isDragging ? styles.dragging : ""} ${selectedFile ? styles.hasFile : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleInputChange}
                  className={styles.fileInput}
                />

                {selectedFile ? (
                  <div className={styles.selectedFile}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>{selectedFile.name}</span>
                      <span className={styles.fileMeta}>
                        {formatFileSize(selectedFile.size)}
                        {pageCount && ` · ${pageCount} pages`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.removeFile}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setPageCount(null);
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className={styles.dropPrompt}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Drop PDF here or click to browse</span>
                    <span className={styles.dropHint}>Maximum 10 MB</span>
                  </div>
                )}
              </div>

              {error && (
                <div className={styles.error}>{error}</div>
              )}

              <label className={styles.versionField}>
                <span>Version label</span>
                <input
                  type="text"
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  placeholder="e.g. v1.2"
                />
              </label>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ResourcesClient({ resources, totalInstructors }) {
  const [successMessage, setSuccessMessage] = useState(null);

  const handleUploadSuccess = (key, version) => {
    const config = RESOURCE_CONFIG[key];
    setSuccessMessage({
      title: config?.title || key,
      version,
    });
    // Auto-dismiss after 10 seconds
    setTimeout(() => setSuccessMessage(null), 10000);
  };

  // Separate resources by state
  const handbook = resources.find((r) => r.key === "handbook");
  const lessonPlans = resources.find((r) => r.key === "lesson_plans");
  const otherResources = resources.filter((r) => !["handbook", "lesson_plans"].includes(r.key));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Resources</h1>
        <p>Manage documents for instructors.</p>
      </div>

      {successMessage && (
        <div className={styles.successBar}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {successMessage.title} {successMessage.version && `(${successMessage.version})`} uploaded successfully.
          </span>
          <Link
            href={`/admin/updates?prefill=handbook&version=${encodeURIComponent(successMessage.version || "")}`}
            className={styles.successLink}
          >
            Send update to instructors
          </Link>
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={() => setSuccessMessage(null)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className={styles.grid}>
        {handbook && (
          <ResourceCard
            resource={handbook}
            totalInstructors={totalInstructors}
            onUploadSuccess={handleUploadSuccess}
          />
        )}
        {lessonPlans && (
          <ResourceCard
            resource={lessonPlans}
            totalInstructors={totalInstructors}
            onUploadSuccess={handleUploadSuccess}
          />
        )}
        {otherResources.map((resource) => (
          <ResourceCard
            key={resource.key}
            resource={resource}
            totalInstructors={totalInstructors}
            onUploadSuccess={handleUploadSuccess}
          />
        ))}
      </div>
    </div>
  );
}
