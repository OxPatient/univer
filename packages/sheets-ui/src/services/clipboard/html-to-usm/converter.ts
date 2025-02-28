/**
 * Copyright 2023-present DreamNum Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { IDocumentBody, IDocumentData, ITextRun, ITextStyle, Nullable } from '@univerjs/core';
import { ObjectMatrix } from '@univerjs/core';
import { handleStringToStyle } from '@univerjs/ui';

import type { ISheetSkeletonManagerParam } from '../../sheet-skeleton-manager.service';
import type {
    ICellDataWithSpanInfo,
    IClipboardPropertyItem,
    IParsedCellValue,
    IUniverSheetCopyDataModel,
} from '../type';
import { extractNodeStyle } from './parse-node-style';
import type { IAfterProcessRule } from './paste-plugins/type';
import parseToDom, { generateParagraphs } from './utils';

export interface IStyleRule {
    filter: string | string[] | ((node: HTMLElement) => boolean);
    getStyle(node: HTMLElement): ITextStyle;
}

export interface IParsedTablesInfo {
    index: number;
}

export interface IPasteExtension {
    name: string;
    checkPasteType(html: string): boolean;
    stylesRules: IStyleRule[];
    afterProcessRules: IAfterProcessRule[];
}

function matchFilter(node: HTMLElement, filter: IStyleRule['filter']) {
    const tagName = node.tagName.toLowerCase();

    if (typeof filter === 'string') {
        return tagName === filter;
    }

    if (Array.isArray(filter)) {
        return filter.some((name) => name === tagName);
    }

    return filter(node);
}

interface IHtmlToUSMServiceProps {
    getCurrentSkeleton: () => Nullable<ISheetSkeletonManagerParam>;
}

export class HtmlToUSMService {
    private static pluginList: IPasteExtension[] = [];

    static use(plugin: IPasteExtension) {
        if (this.pluginList.includes(plugin)) {
            throw new Error(`Univer paste plugin ${plugin.name} already added`);
        }

        this.pluginList.push(plugin);
    }

    private styleCache: Map<ChildNode, ITextStyle> = new Map();

    private styleRules: IStyleRule[] = [];

    private afterProcessRules: IAfterProcessRule[] = [];

    private getCurrentSkeleton: () => Nullable<ISheetSkeletonManagerParam>;

    constructor(props: IHtmlToUSMServiceProps) {
        this.getCurrentSkeleton = props.getCurrentSkeleton;
    }

    convert(html: string): IUniverSheetCopyDataModel {
        const pastePlugin = HtmlToUSMService.pluginList.find((plugin) => plugin.checkPasteType(html));
        if (pastePlugin) {
            this.styleRules = [...pastePlugin.stylesRules];
            this.afterProcessRules = [...pastePlugin.afterProcessRules];
        }
        const valueMatrix = new ObjectMatrix<ICellDataWithSpanInfo>();
        const dom = parseToDom(html);
        const newDocBody: IDocumentBody = {
            dataStream: '',
            textRuns: [],
        };

        const rowProperties: IClipboardPropertyItem[] = [];
        let colProperties: IClipboardPropertyItem[] = [];
        // pick tables
        const tableStrings = html.match(/<table.*?>([\s\S]*?)<\/table>/gi);

        const tables: IParsedTablesInfo[] = [];
        this.process(null, dom?.childNodes!, newDocBody, tables);
        const { paragraphs, dataStream, textRuns } = newDocBody;

        // use paragraph to split rows
        if (paragraphs) {
            const starts = paragraphs.map((p) => p.startIndex + 1);
            starts.unshift(0);
            for (let i = 0; i < starts.length; i++) {
                let cellDataStream;
                if (i === starts.length - 1) {
                    cellDataStream = `${dataStream.substring(starts[i])}\r\n`;
                } else {
                    cellDataStream = `${dataStream.substring(starts[i], starts[i + 1] - 1)}\r\n`;
                }
                const cellTextRuns: ITextRun[] = [];
                textRuns?.forEach((t) => {
                    if (t.st >= starts[i] && t.ed <= starts[i + 1]) {
                        cellTextRuns.push({
                            st: t.st - starts[i],
                            ed: t.ed - starts[i],
                            ts: t.ts,
                        });
                    }
                });
                // set rich format
                const p = this._generateDocumentDataModelSnapshot({
                    body: {
                        dataStream: cellDataStream,
                        textRuns: cellTextRuns,
                        paragraphs: generateParagraphs(cellDataStream),
                    },
                });
                valueMatrix.setValue(valueMatrix.getLength(), 0, {
                    v: cellDataStream,
                    p,
                });
                rowProperties.push({}); // TODO@yuhongz

                if (tableStrings) {
                    tables.forEach((t) => {
                        const curRow = valueMatrix.getLength();
                        if (t.index === i) {
                            const tableString = tableStrings.shift();
                            const {
                                cellMatrix,
                                colProperties: tableColProp,
                                rowProperties: tableRowProp,
                            } = this._parseTable(tableString!);

                            if (tableColProp) {
                                colProperties = tableColProp;
                            }
                            cellMatrix &&
                                cellMatrix.forValue((row, col, value) => {
                                    valueMatrix.setValue(curRow + row, col, value);
                                });
                            rowProperties.push(...tableRowProp);
                        }
                    });
                }
            }
        } else {
            if (dataStream) {
                const singleDataStream = `${dataStream}\r\n`;
                const singleDocBody: IDocumentBody = {
                    dataStream: singleDataStream,
                    textRuns,
                    paragraphs: generateParagraphs(singleDataStream),
                };
                const p = this._generateDocumentDataModelSnapshot({
                    body: singleDocBody,
                });
                valueMatrix.setValue(0, 0, {
                    v: dataStream,
                    p,
                });
                rowProperties.push({}); // TODO@yuhongz
            }

            if (tableStrings) {
                tableStrings.forEach((t) => {
                    const curRow = valueMatrix.getLength();
                    const { cellMatrix } = this._parseTable(t!);

                    cellMatrix &&
                        cellMatrix.forValue((row, col, value) => {
                            valueMatrix.setValue(curRow + row, col, value);
                        });
                    rowProperties.push(...rowProperties);
                });
            }
        }
        return {
            rowProperties: [],
            colProperties: [],
            cellMatrix: valueMatrix,
        };
    }

    private _parseTable(html: string) {
        const valueMatrix = new ObjectMatrix<ICellDataWithSpanInfo>();
        const colProperties = parseColGroup(html);
        const { rowProperties, rowCount, cellMatrix: parsedCellMatrix } = parseTableRows(html);
        parsedCellMatrix &&
            parsedCellMatrix.forValue((row, col, value) => {
                // TODO@Dushusir Temporarily use handleStringToStyle. After all replication and paste function is completed, fix the handleStringToStyle method
                const style = handleStringToStyle(undefined, value.properties?.style);

                valueMatrix.setValue(row, col, {
                    v: value.content,
                    s: style,
                    rowSpan: value.rowSpan,
                    colSpan: value.colSpan,
                });
            });
        return {
            rowProperties: [],
            colProperties: [],
            cellMatrix: valueMatrix,
        };
    }

    private _generateDocumentDataModelSnapshot(snapshot: Partial<IDocumentData>) {
        const currentSkeleton = this.getCurrentSkeleton();
        if (currentSkeleton == null) {
            return null;
        }
        const { skeleton } = currentSkeleton;
        const documentModel = skeleton.getBlankCellDocumentModel()?.documentModel;
        const p = documentModel?.getSnapshot();
        const documentData = { ...p, ...snapshot };
        documentModel?.reset(documentData);
        return documentModel?.getSnapshot();
    }

    private process(
        parent: Nullable<ChildNode>,
        nodes: NodeListOf<ChildNode>,
        doc: IDocumentBody,
        tables: IParsedTablesInfo[]
    ) {
        for (const node of nodes) {
            if (node.nodeName.toLowerCase() === 'table') {
                tables.push({
                    index: doc?.paragraphs?.length || 0,
                });
            } else if (node.nodeType === Node.TEXT_NODE) {
                // TODO: @JOCS, More characters need to be replaced, like `\b`
                const text = node.nodeValue?.replace(/[\r\n]/g, '');
                let style;

                if (parent && this.styleCache.has(parent)) {
                    style = this.styleCache.get(parent);
                }
                const newDoc: IDocumentBody = {
                    dataStream: '',
                    textRuns: [],
                };

                doc.dataStream += text;
                newDoc.dataStream += text;
                if (style && Object.getOwnPropertyNames(style).length) {
                    doc.textRuns!.push({
                        st: doc.dataStream.length - text!.length,
                        ed: doc.dataStream.length,
                        ts: style,
                    });
                    newDoc.textRuns!.push({
                        st: doc.dataStream.length - text!.length,
                        ed: doc.dataStream.length,
                        ts: style,
                    });
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const parentStyles = parent ? this.styleCache.get(parent) : {};
                const styleRule = this.styleRules.find(({ filter }) => matchFilter(node as HTMLElement, filter));
                const nodeStyles = styleRule
                    ? styleRule.getStyle(node as HTMLElement)
                    : extractNodeStyle(node as HTMLElement);

                this.styleCache.set(node, { ...parentStyles, ...nodeStyles });

                const { childNodes } = node;

                this.process(node, childNodes, doc, tables);

                const afterProcessRule = this.afterProcessRules.find(({ filter }) =>
                    matchFilter(node as HTMLElement, filter)
                );

                if (afterProcessRule) {
                    afterProcessRule.handler(doc, node as HTMLElement);
                }
            }
        }
    }
}

/**
 * This function parses <tr> elements in the table. So it would return several things.
 * @param html raw content
 * @returns
 */
function parseTableRows(html: string): {
    rowProperties: IClipboardPropertyItem[];
    rowCount: number;
    colCount: number;
    cellMatrix: ObjectMatrix<IParsedCellValue> | null;
} {
    const ROWS_REGEX = /<tr([\s\S]*?)>([\s\S]*?)<\/tr>/gi;
    const rowMatches = html.matchAll(ROWS_REGEX);
    if (!rowMatches) {
        return {
            rowProperties: [],
            rowCount: 0,
            colCount: 0,
            cellMatrix: null,
        };
    }

    const rowMatchesAsArray = Array.from(rowMatches);
    const rowProperties = rowMatchesAsArray.map((rowMatch) => parseProperties(rowMatch[1]));

    const { colCount, cellMatrix } = parseTableCells(rowMatchesAsArray.map((rowMatch) => rowMatch[2]));

    return {
        rowProperties,
        rowCount: rowProperties.length,
        colCount,
        cellMatrix,
    };
}

/**
 *
 * @param tdStrings
 */
function parseTableCells(tdStrings: string[]) {
    const cellMatrix = new ObjectMatrix<IParsedCellValue>();
    const maxRowOfCol = new Map<number, number>();
    const TDS_REGEX = /<td([\s\S]*?)>([\s\S]*?)<\/td>/gi;

    let colCount = 0;
    let colIndex = 0;
    let rowIndex = 0;

    tdStrings.forEach((trStr, r) => {
        const isFirstRow = r === 0;
        const cellMatches = trStr.matchAll(TDS_REGEX);

        colIndex = 0;

        Array.from(cellMatches).forEach((cellMatch) => {
            const cellProperties = parseProperties(cellMatch[1]);
            const content = cellMatch[2].replace(/&nbsp;/g, ' '); // paste from excel
            const rowSpan = cellProperties.rowspan ? +cellProperties.rowspan : 1;
            const colSpan = cellProperties.colspan ? +cellProperties.colspan : 1;

            if (!isFirstRow) {
                for (let i = colIndex; i < colCount; i++) {
                    const thisPosOccupied = maxRowOfCol.get(i)! >= rowIndex;
                    if (!thisPosOccupied) {
                        colIndex = i;
                        break;
                    }
                }
            }

            const value: IParsedCellValue = {
                content,
                properties: cellProperties,
            };
            if (colSpan > 1) value.colSpan = +colSpan;
            if (rowSpan > 1) value.rowSpan = +rowSpan;

            // when iterating the first row, we should calc colCount as well
            if (isFirstRow) {
                colCount += colSpan;
            }

            // update maxRowOfCol
            for (let i = colIndex; i < colIndex + colSpan; i++) {
                maxRowOfCol.set(i, rowIndex + rowSpan - 1);
            }

            // set value to matrix
            cellMatrix.setValue(rowIndex, colIndex, value);

            // point to next colIndex
            colIndex += colSpan;
        });

        rowIndex += 1;
    });

    return {
        colCount,
        cellMatrix,
    };
}

function parseProperties(propertyStr: string): IClipboardPropertyItem {
    if (!propertyStr) {
        return {};
    }

    const PROPERTY_REGEX = /([\w-]+)="([^"]*)"/gi;
    const propertyMatches = propertyStr.matchAll(PROPERTY_REGEX);
    const property: IClipboardPropertyItem = {};
    Array.from(propertyMatches).forEach((m) => {
        const [_, key, val] = m;
        property[key] = val;
    });

    return property;
}

/**
 * Parse columns and their properties from colgroup element.
 *
 * @param raw content
 * @returns cols and their properties
 */
function parseColGroup(raw: string): IClipboardPropertyItem[] | null {
    const COLGROUP_TAG_REGEX = /<colgroup([\s\S]*?)>(.*?)<\/colgroup>/;
    const colgroupMatch = raw.match(COLGROUP_TAG_REGEX);
    if (!colgroupMatch || !colgroupMatch[2]) {
        return null;
    }

    const COL_TAG_REGEX = /<col([\s\S]*?)>/g;
    const colMatches = colgroupMatch[2].matchAll(COL_TAG_REGEX);
    if (!colMatches) {
        return null;
    }

    return Array.from(colMatches).map((colMatch) => parseProperties(colMatch[1]));
}

function childNodeToHTML(node: ChildNode) {
    const serializer = new XMLSerializer();
    const htmlString = serializer.serializeToString(node);
    return htmlString;
}
