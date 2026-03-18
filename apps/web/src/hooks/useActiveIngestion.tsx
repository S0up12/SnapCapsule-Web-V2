import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { isTerminalIngestionStatus, useIngestionJob, type IngestionJob } from "./useIngestionJob";

const ACTIVE_INGESTION_JOB_STORAGE_KEY = "snapcapsule:active-ingestion-job";

type ActiveIngestionContextValue = {
  activeJobId: string | null;
  activeJob: IngestionJob | null;
  activeJobQuery: ReturnType<typeof useIngestionJob>;
  finishedJob: IngestionJob | null;
  isRestoringActiveJob: boolean;
  resumeError: string | null;
  setTrackedJobId: (jobId: string | null) => void;
  clearFinishedJob: () => void;
};

const ActiveIngestionContext = createContext<ActiveIngestionContextValue | null>(null);

function readPersistedJobId() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(ACTIVE_INGESTION_JOB_STORAGE_KEY);
}

function persistJobId(jobId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (jobId) {
    window.localStorage.setItem(ACTIVE_INGESTION_JOB_STORAGE_KEY, jobId);
    return;
  }

  window.localStorage.removeItem(ACTIVE_INGESTION_JOB_STORAGE_KEY);
}

export function ActiveIngestionProvider({ children }: { children: ReactNode }) {
  const [activeJobId, setActiveJobId] = useState<string | null>(() => readPersistedJobId());
  const [finishedJob, setFinishedJob] = useState<IngestionJob | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const activeJobQuery = useIngestionJob(activeJobId);

  useEffect(() => {
    persistJobId(activeJobId);
  }, [activeJobId]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== ACTIVE_INGESTION_JOB_STORAGE_KEY) {
        return;
      }

      setActiveJobId(event.newValue);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!activeJobQuery.data) {
      return;
    }

    if (!isTerminalIngestionStatus(activeJobQuery.data.status)) {
      setResumeError(null);
      return;
    }

    setFinishedJob(activeJobQuery.data);
    setResumeError(null);
    setActiveJobId(null);
  }, [activeJobQuery.data]);

  useEffect(() => {
    if (!activeJobQuery.isError || !activeJobId) {
      return;
    }

    setResumeError(
      activeJobQuery.error instanceof Error
        ? activeJobQuery.error.message
        : "Failed to restore ingestion status.",
    );
    setActiveJobId(null);
  }, [activeJobId, activeJobQuery.error, activeJobQuery.isError]);

  const isRestoringActiveJob =
    activeJobId !== null && activeJobQuery.isLoading && !activeJobQuery.data;
  const activeJob =
    activeJobQuery.data && !isTerminalIngestionStatus(activeJobQuery.data.status)
      ? activeJobQuery.data
      : null;

  function setTrackedJobId(jobId: string | null) {
    setResumeError(null);
    if (jobId) {
      setFinishedJob(null);
    }
    setActiveJobId(jobId);
  }

  function clearFinishedJob() {
    setFinishedJob(null);
  }

  return (
    <ActiveIngestionContext.Provider
      value={{
        activeJobId,
        activeJob,
        activeJobQuery,
        finishedJob,
        isRestoringActiveJob,
        resumeError,
        setTrackedJobId,
        clearFinishedJob,
      }}
    >
      {children}
    </ActiveIngestionContext.Provider>
  );
}

export function useActiveIngestion() {
  const value = useContext(ActiveIngestionContext);
  if (!value) {
    throw new Error("useActiveIngestion must be used within an ActiveIngestionProvider.");
  }
  return value;
}
