"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";
import {
  uploadResource,
  getSignedUrl,
  createResource,
  updateResource,
  archiveResource,
  swapResourceOrder,
} from "@/lib/resources/actions";
import {
  formatResourceDateFull,
  formatFileSize,
  getNextVersion,
  formatResourceDate,
} from "@/lib/resources/queries";

const ICONS = {
  book: {
    label: "Book",
    color: "#E1EEF1",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
        <path d="M20 4h-6a3 3 0 0 0-3 3M20 4v14h-6" />
      </svg>
    ),
  },
  shield: {
    label: "Shield",
    color: "#DCE8FB",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
        <path d="M12 9v6M9 12h6" />
      </svg>
    ),
  },
  video: {
    label: "Video",
    color: "#FDF0DF",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
  link: {
    label: "Link",
    color: "#E8F4F6",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  form: {
    label: "Form",
    color: "#E5ECFA",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  folder: {
    label: "Folder",
    color: "#F1F2F6",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    ),
  },
};

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// File Resource Card (with upload functionality)
function FileCard({ resource, totalInstructors, onSuccess }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [pageCount, setPageCount] = useState(null);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState(resource.title);
  const [editSubtitle, setEditSubtitle] = useState(resource.subtitle || "");
  const [editIcon, setEditIcon] = useState(resource.icon);

  const iconConfig = ICONS[resource.icon] || ICONS.book;
  const hasFile = !!resource.file_path;
  const isProtected = ["handbook", "lesson_plans"].includes(resource.key);

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
    formData.append("versionLabel", versionLabel.trim() || "v1");
    const result = await uploadResource(resource.key, formData);
    if (result.error) {
      setError(result.error);
      setUploading(false);
      return;
    }
    setShowUploadModal(false);
    setSelectedFile(null);
    setVersionLabel("");
    setPageCount(null);
    setUploading(false);
    onSuccess?.(resource.title, versionLabel.trim() || "v1");
    router.refresh();
  };

  const openUploadModal = () => {
    const nextVersion = getNextVersion(resource.version_label) || "v1";
    setVersionLabel(nextVersion);
    setSelectedFile(null);
    setPageCount(null);
    setError(null);
    setShowUploadModal(true);
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
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

  const handleSaveEdit = async () => {
    setSaving(true);
    const result = await updateResource(resource.key, {
      title: editTitle,
      subtitle: editSubtitle,
      icon: editIcon,
    });
    setSaving(false);
    if (result.error) {
      alert(result.error);
      return;
    }
    setShowEditModal(false);
    router.refresh();
  };

  const handleToggleVisibility = async () => {
    setShowMenu(false);
    await updateResource(resource.key, { visible: !resource.visible });
    router.refresh();
  };

  const handleRemove = async () => {
    if (!confirm(`Remove "${resource.title}"? Instructors won't see it anymore.`)) return;
    setShowMenu(false);
    const result = await archiveResource(resource.key);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

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
      <div className={`${styles.card} ${!resource.visible ? styles.cardHidden : ""}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon} style={{ backgroundColor: iconConfig.color }}>
            {iconConfig.svg}
          </div>
          <div className={styles.cardMeta}>
            <h3 className={styles.cardTitle}>{resource.title}</h3>
            <p className={styles.cardSubtitle}>{resource.subtitle}</p>
          </div>
          <div className={styles.cardPills}>
            {!resource.visible && <span className={styles.hiddenPill}>Hidden</span>}
            {hasFile && resource.visible && <span className={styles.statusPill}>Live</span>}
            {!hasFile && <span className={styles.comingSoonPill}>No file</span>}
          </div>
          <div className={styles.menuWrapper}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setShowMenu(!showMenu)}
              aria-label="More options"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className={styles.menuBackdrop} onClick={() => setShowMenu(false)} />
                <div className={styles.menu}>
                  <button onClick={() => { setShowMenu(false); setShowEditModal(true); }}>
                    Edit details
                  </button>
                  <button onClick={handleToggleVisibility}>
                    {resource.visible ? "Hide from instructors" : "Show to instructors"}
                  </button>
                  {!isProtected && (
                    <button onClick={handleRemove} className={styles.menuDanger}>
                      Remove
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {hasFile && (
          <div className={styles.cardDetails}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Version</span>
              <span className={styles.detailValue}>{resource.version_label || "-"}</span>
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
          <button type="button" className={styles.uploadBtn} onClick={openUploadModal}>
            {hasFile ? "Upload new version" : "Upload"}
          </button>
          {hasFile && (
            <Link href={`/instructor/resources/${resource.key}`} target="_blank" className={styles.viewBtn}>
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
                      <span className={styles.historyDate}>{formatResourceDateFull(item.date)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className={styles.modalOverlay} onClick={closeUploadModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Upload {resource.title}</h2>
              <button type="button" className={styles.closeBtn} onClick={closeUploadModal}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div
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
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPageCount(null); }}
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
              {error && <div className={styles.error}>{error}</div>}
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
              <button type="button" className={styles.cancelBtn} onClick={closeUploadModal}>
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

      {/* Edit Modal */}
      {showEditModal && (
        <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Edit {resource.title}</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setShowEditModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.field}>
                <span>Title</span>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={60}
                />
              </label>
              <label className={styles.field}>
                <span>Short description</span>
                <input
                  type="text"
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  maxLength={80}
                  placeholder="Optional"
                />
              </label>
              <div className={styles.field}>
                <span>Icon</span>
                <div className={styles.iconPicker} role="group" aria-label="Icon">
                  {Object.entries(ICONS).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.iconOption} ${editIcon === key ? styles.iconActive : ""}`}
                      style={{ backgroundColor: cfg.color }}
                      onClick={() => setEditIcon(key)}
                      aria-pressed={editIcon === key}
                      aria-label={cfg.label}
                    >
                      {cfg.svg}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleSaveEdit}
                disabled={saving || !editTitle.trim()}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Link Resource Card
function LinkCard({ resource, totalInstructors }) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editTitle, setEditTitle] = useState(resource.title);
  const [editSubtitle, setEditSubtitle] = useState(resource.subtitle || "");
  const [editIcon, setEditIcon] = useState(resource.icon);
  const [editUrl, setEditUrl] = useState(resource.url || "");

  const iconConfig = ICONS[resource.icon] || ICONS.link;

  const handleSaveEdit = async () => {
    setSaving(true);
    const result = await updateResource(resource.key, {
      title: editTitle,
      subtitle: editSubtitle,
      icon: editIcon,
      url: editUrl,
    });
    setSaving(false);
    if (result.error) {
      alert(result.error);
      return;
    }
    setShowEditModal(false);
    router.refresh();
  };

  const handleToggleVisibility = async () => {
    setShowMenu(false);
    await updateResource(resource.key, { visible: !resource.visible });
    router.refresh();
  };

  const handleRemove = async () => {
    if (!confirm(`Remove "${resource.title}"? Instructors won't see it anymore.`)) return;
    setShowMenu(false);
    const result = await archiveResource(resource.key);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <>
      <div className={`${styles.card} ${!resource.visible ? styles.cardHidden : ""}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIcon} style={{ backgroundColor: iconConfig.color }}>
            {iconConfig.svg}
          </div>
          <div className={styles.cardMeta}>
            <h3 className={styles.cardTitle}>{resource.title}</h3>
            <p className={styles.cardSubtitle}>{resource.subtitle}</p>
          </div>
          <div className={styles.cardPills}>
            {!resource.visible && <span className={styles.hiddenPill}>Hidden</span>}
            {resource.visible && <span className={styles.linkPill}>Link</span>}
          </div>
          <div className={styles.menuWrapper}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setShowMenu(!showMenu)}
              aria-label="More options"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className={styles.menuBackdrop} onClick={() => setShowMenu(false)} />
                <div className={styles.menu}>
                  <button onClick={() => { setShowMenu(false); setShowEditModal(true); }}>
                    Edit details
                  </button>
                  <button onClick={handleToggleVisibility}>
                    {resource.visible ? "Hide from instructors" : "Show to instructors"}
                  </button>
                  <button onClick={handleRemove} className={styles.menuDanger}>
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.cardDetails}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>URL</span>
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.detailLink}
            >
              {extractDomain(resource.url)}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Opened by</span>
            <span className={styles.detailValue}>
              {resource.openCount} of {totalInstructors} instructors
            </span>
          </div>
        </div>

        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => setShowEditModal(true)}
          >
            Edit
          </button>
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.viewBtn}
          >
            Open link
          </a>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Edit {resource.title}</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setShowEditModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.field}>
                <span>Title</span>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={60}
                />
              </label>
              <label className={styles.field}>
                <span>Short description</span>
                <input
                  type="text"
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  maxLength={80}
                  placeholder="Optional"
                />
              </label>
              <label className={styles.field}>
                <span>URL</span>
                <input
                  type="url"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://..."
                />
                {editUrl && extractDomain(editUrl) && (
                  <span className={styles.urlPreview}>{extractDomain(editUrl)}</span>
                )}
              </label>
              <div className={styles.field}>
                <span>Icon</span>
                <div className={styles.iconPicker} role="group" aria-label="Icon">
                  {Object.entries(ICONS).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.iconOption} ${editIcon === key ? styles.iconActive : ""}`}
                      style={{ backgroundColor: cfg.color }}
                      onClick={() => setEditIcon(key)}
                      aria-pressed={editIcon === key}
                      aria-label={cfg.label}
                    >
                      {cfg.svg}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleSaveEdit}
                disabled={saving || !editTitle.trim() || !editUrl.trim()}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Add Resource Modal
function AddResourceModal({ onClose, onSuccess }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [kind, setKind] = useState("file");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [icon, setIcon] = useState("book");
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [pageCount, setPageCount] = useState(null);
  const [versionLabel, setVersionLabel] = useState("v1");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
    const count = await extractPageCountPreview(file);
    setPageCount(count);
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

  const handleSubmit = async () => {
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (kind === "link") {
      if (!url.trim()) {
        setError("URL is required");
        return;
      }
      if (!url.startsWith("https://")) {
        setError("URL must start with https://");
        return;
      }
    }

    setSaving(true);

    // Create the resource
    const result = await createResource({
      title: title.trim(),
      subtitle: subtitle.trim(),
      kind,
      icon,
      url: kind === "link" ? url.trim() : null,
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    // For files, upload if a file was selected
    if (kind === "file" && selectedFile && result.resource) {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("versionLabel", versionLabel.trim() || "v1");
      const uploadResult = await uploadResource(result.resource.key, formData);
      if (uploadResult.error) {
        // Resource was created but file upload failed
        setError(`Resource created, but file upload failed: ${uploadResult.error}`);
        setSaving(false);
        router.refresh();
        return;
      }
    }

    setSaving(false);
    onSuccess?.(title.trim(), kind === "file" ? versionLabel : null);
    onClose();
    router.refresh();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Add resource</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={styles.modalBody}>
          {/* Type Selection */}
          <div className={styles.field}>
            <span>Type</span>
            <div className={styles.typeButtons} role="group" aria-label="Resource type">
              <button
                type="button"
                className={`${styles.typeBtn} ${kind === "file" ? styles.typeBtnActive : ""}`}
                onClick={() => setKind("file")}
                aria-pressed={kind === "file"}
              >
                File (PDF)
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${kind === "link" ? styles.typeBtnActive : ""}`}
                onClick={() => setKind("link")}
                aria-pressed={kind === "link"}
              >
                Link
              </button>
            </div>
          </div>

          <label className={styles.field}>
            <span>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              placeholder="e.g. Training videos"
            />
          </label>

          <label className={styles.field}>
            <span>Short description</span>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              maxLength={80}
              placeholder="Optional"
            />
          </label>

          <div className={styles.field}>
            <span>Icon</span>
            <div className={styles.iconPicker} role="group" aria-label="Icon">
              {Object.entries(ICONS).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.iconOption} ${icon === key ? styles.iconActive : ""}`}
                  style={{ backgroundColor: cfg.color }}
                  onClick={() => setIcon(key)}
                  aria-pressed={icon === key}
                  aria-label={cfg.label}
                >
                  {cfg.svg}
                </button>
              ))}
            </div>
          </div>

          {kind === "file" && (
            <>
              <div
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
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
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
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPageCount(null); }}
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
                    <span className={styles.dropHint}>Maximum 10 MB (optional)</span>
                  </div>
                )}
              </div>
              {selectedFile && (
                <label className={styles.field}>
                  <span>Version label</span>
                  <input
                    type="text"
                    value={versionLabel}
                    onChange={(e) => setVersionLabel(e.target.value)}
                    placeholder="e.g. v1"
                  />
                </label>
              )}
            </>
          )}

          {kind === "link" && (
            <label className={styles.field}>
              <span>URL</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
              {url && extractDomain(url) && (
                <span className={styles.urlPreview}>{extractDomain(url)}</span>
              )}
            </label>
          )}

          {error && <div className={styles.error}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={saving || !title.trim() || (kind === "link" && !url.trim())}
          >
            {saving ? "Adding..." : "Add to Resources"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Preview Section
function InstructorPreview({ resources }) {
  return (
    <div className={styles.preview}>
      <h3 className={styles.previewTitle}>What instructors see</h3>
      <div className={styles.previewCard}>
        {resources.map((resource) => {
          const iconConfig = ICONS[resource.icon] || ICONS.book;
          const isLink = resource.kind === "link";
          const hasContent = isLink ? !!resource.url : !!resource.file_path;

          return (
            <div
              key={resource.key}
              className={`${styles.previewRow} ${!resource.visible ? styles.previewRowHidden : ""}`}
            >
              <div
                className={styles.previewIcon}
                style={{ backgroundColor: iconConfig.color }}
              >
                {iconConfig.svg}
              </div>
              <div className={styles.previewText}>
                <span className={styles.previewRowTitle}>{resource.title}</span>
                <span className={styles.previewRowSub}>
                  {resource.subtitle}
                  {resource.kind === "file" && resource.file_path && resource.version_label && (
                    <> · {resource.version_label}, updated {formatResourceDate(resource.updated_at)}</>
                  )}
                </span>
              </div>
              {!resource.visible && <span className={styles.previewHiddenBadge}>Hidden</span>}
              {!hasContent && resource.visible && <span className={styles.previewComingSoon}>Coming soon</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResourcesClient({ resources, totalInstructors }) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSuccess = (title, version) => {
    setSuccessMessage({ title, version });
    setTimeout(() => setSuccessMessage(null), 10000);
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const current = resources[index];
    const prev = resources[index - 1];
    await swapResourceOrder(current.key, prev.key);
    router.refresh();
  };

  const handleMoveDown = async (index) => {
    if (index === resources.length - 1) return;
    const current = resources[index];
    const next = resources[index + 1];
    await swapResourceOrder(current.key, next.key);
    router.refresh();
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Resources</h1>
          <p>Manage documents and links for instructors.</p>
        </div>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setShowAddModal(true)}
        >
          + Add resource
        </button>
      </div>

      {successMessage && (
        <div className={styles.successBar}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {successMessage.title}
            {successMessage.version && ` (${successMessage.version})`} added successfully.
          </span>
          <Link
            href={`/admin/updates?prefill=resource&title=${encodeURIComponent(successMessage.title)}`}
            className={styles.successLink}
          >
            Send an update to instructors
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

      <div className={styles.columns}>
        <div className={styles.mainColumn}>
          <div className={styles.grid}>
            {resources.map((resource, index) => (
              <div key={resource.key} className={styles.cardWrapper}>
                {resource.kind === "link" ? (
                  <LinkCard
                    resource={resource}
                    totalInstructors={totalInstructors}
                  />
                ) : (
                  <FileCard
                    resource={resource}
                    totalInstructors={totalInstructors}
                    onSuccess={handleSuccess}
                  />
                )}
                <div className={styles.reorderBtns}>
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === resources.length - 1}
                    aria-label="Move down"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.sideColumn}>
          <InstructorPreview resources={resources} />
        </div>
      </div>

      {showAddModal && (
        <AddResourceModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
