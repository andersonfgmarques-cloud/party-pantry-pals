/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as PreviewRouteImport } from './routes/preview'
const IndexRoute = IndexRouteImport.update({ id:'/', path:'/', getParentRoute:()=>rootRouteImport } as any)
const PreviewRoute = PreviewRouteImport.update({ id:'/preview', path:'/preview', getParentRoute:()=>rootRouteImport } as any)
export interface FileRoutesByFullPath { '/': typeof IndexRoute; '/preview': typeof PreviewRoute }
export interface FileRoutesByTo { '/': typeof IndexRoute; '/preview': typeof PreviewRoute }
export interface FileRoutesById { __root__: typeof rootRouteImport; '/': typeof IndexRoute; '/preview': typeof PreviewRoute }
export interface FileRouteTypes { fileRoutesByFullPath:FileRoutesByFullPath; fullPaths:'/'|'/preview'; fileRoutesByTo:FileRoutesByTo; to:'/'|'/preview'; id:'__root__'|'/'|'/preview'; fileRoutesById:FileRoutesById }
export interface RootRouteChildren { IndexRoute:typeof IndexRoute; PreviewRoute:typeof PreviewRoute }
declare module '@tanstack/react-router' { interface FileRoutesByPath { '/preview': { id:'/preview'; path:'/preview'; fullPath:'/preview'; preLoaderRoute:typeof PreviewRouteImport; parentRoute:typeof rootRouteImport } } }
const rootRouteChildren:RootRouteChildren={IndexRoute,PreviewRoute}
export const routeTree=rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()
