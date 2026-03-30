import { createContext, useContext } from "react";

const DocsStoryPreviewContext = createContext(false);

export const DocsStoryPreviewProvider = DocsStoryPreviewContext.Provider;

export const useDocsStoryPreviewMode = () => useContext(DocsStoryPreviewContext);
