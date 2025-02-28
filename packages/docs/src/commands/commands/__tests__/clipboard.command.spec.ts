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

import type { ICommand, IDocumentData, IStyleBase, Univer } from '@univerjs/core';
import { BooleanNumber, ICommandService, IUniverInstanceService, UndoCommand } from '@univerjs/core';
import type { Injector } from '@wendellhu/redi';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TextSelectionManagerService } from '../../../services/text-selection-manager.service';
import { RichTextEditingMutation } from '../../mutations/core-editing.mutation';
import { SetTextSelectionsOperation } from '../../operations/text-selection.operation';
import type { IInnerCutCommandParams, IInnerPasteCommandParams } from '../clipboard.inner.command';
import { CutContentCommand, InnerPasteCommand } from '../clipboard.inner.command';
import { createCommandTestBed } from './create-command-test-bed';

vi.mock('@univerjs/engine-render', async () => {
    const actual = await vi.importActual('@univerjs/engine-render');
    const { ITextSelectionRenderManager, TextSelectionRenderManager } = await import(
        './mock-text-selection-render-manager'
    );

    return {
        ...actual,
        ITextSelectionRenderManager,
        TextSelectionRenderManager,
    };
});

const TEST_DOCUMENT_DATA_EN: IDocumentData = {
    id: 'test-doc',
    body: {
        dataStream: 'What’s New in the 2022\r Gartner Hype Cycle for Emerging Technologies\r\n',
        textRuns: [
            {
                st: 0,
                ed: 22,
                ts: {
                    bl: BooleanNumber.FALSE,
                    fs: 24,
                    cl: {
                        rgb: 'rgb(0, 40, 86)',
                    },
                },
            },
            {
                st: 23,
                ed: 68,
                ts: {
                    bl: BooleanNumber.TRUE,
                    fs: 24,
                    cl: {
                        rgb: 'rgb(0, 40, 86)',
                    },
                },
            },
        ],
        paragraphs: [
            {
                startIndex: 22,
            },
            {
                startIndex: 68,
                paragraphStyle: {
                    spaceAbove: 20,
                    indentFirstLine: 20,
                },
            },
        ],
        sectionBreaks: [],
        customBlocks: [],
    },
    documentStyle: {
        pageSize: {
            width: 594.3,
            height: 840.51,
        },
        marginTop: 72,
        marginBottom: 72,
        marginRight: 90,
        marginLeft: 90,
    },
};

describe('test cases in clipboard', () => {
    let univer: Univer;
    let get: Injector['get'];
    let commandService: ICommandService;

    function getFormatValueAt(key: keyof IStyleBase, pos: number) {
        const univerInstanceService = get(IUniverInstanceService);
        const docsModel = univerInstanceService.getUniverDocInstance('test-doc');

        if (docsModel?.body?.textRuns == null) {
            return;
        }

        for (const textRun of docsModel.body?.textRuns) {
            const { st, ed, ts = {} } = textRun;

            if (st <= pos && ed >= pos) {
                return ts[key];
            }
        }
    }

    function getTextByPosition(start: number, end: number) {
        const univerInstanceService = get(IUniverInstanceService);
        const docsModel = univerInstanceService.getUniverDocInstance('test-doc');

        return docsModel?.body?.dataStream.slice(start, end);
    }

    beforeEach(() => {
        const testBed = createCommandTestBed(TEST_DOCUMENT_DATA_EN);
        univer = testBed.univer;
        get = testBed.get;

        commandService = get(ICommandService);
        commandService.registerCommand(InnerPasteCommand);
        commandService.registerCommand(CutContentCommand);
        commandService.registerCommand(SetTextSelectionsOperation);
        commandService.registerCommand(RichTextEditingMutation as unknown as ICommand);

        const selectionManager = get(TextSelectionManagerService);

        selectionManager.setCurrentSelection({
            unitId: 'test-doc',
            subUnitId: '',
        });

        selectionManager.add([
            {
                startOffset: 0,
                endOffset: 5,
            },
        ]);

        selectionManager.add([
            {
                startOffset: 10,
                endOffset: 15,
            },
        ]);
    });

    afterEach(() => univer.dispose());

    describe('Test paste in multiple ranges', () => {
        it('Should paste content to each selection ranges', async () => {
            expect(getTextByPosition(0, 5)).toBe(`What’`);
            expect(getFormatValueAt('bl', 0)).toBe(BooleanNumber.FALSE);

            const commandParams: IInnerPasteCommandParams = {
                segmentId: '',
                body: {
                    dataStream: 'univer',
                    textRuns: [
                        {
                            st: 0,
                            ed: 6,
                            ts: {
                                bl: BooleanNumber.TRUE,
                            },
                        },
                    ],
                },
                textRanges: [], // only used to eliminate TS type check error.
            };

            await commandService.executeCommand(InnerPasteCommand.id, commandParams);

            expect(getTextByPosition(0, 6)).toBe(`univer`);
            expect(getTextByPosition(11, 17)).toBe('univer');
            expect(getFormatValueAt('bl', 0)).toBe(BooleanNumber.TRUE);

            expect(await commandService.executeCommand(UndoCommand.id)).toBeTruthy();
        });
    });

    describe('Test cut in multiple ranges', () => {
        it('Should cut content to each selection ranges', async () => {
            expect(getTextByPosition(0, 5)).toBe(`What’`);
            expect(getFormatValueAt('bl', 0)).toBe(BooleanNumber.FALSE);

            const commandParams: IInnerCutCommandParams = {
                segmentId: '',
                textRanges: [], // only used to eliminate TS type check error.
            };

            await commandService.executeCommand(CutContentCommand.id, commandParams);

            expect(getTextByPosition(0, 5)).toBe(`s New`);

            expect(await commandService.executeCommand(UndoCommand.id)).toBeTruthy();
        });
    });
});
