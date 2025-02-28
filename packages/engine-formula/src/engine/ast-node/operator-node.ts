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

import { ErrorType } from '../../basics/error-type';
import type { compareToken } from '../../basics/token';
import { OPERATOR_TOKEN_COMPARE_SET, OPERATOR_TOKEN_SET, operatorToken } from '../../basics/token';
import type { BaseFunction } from '../../functions/base-function';
import { FUNCTION_NAMES_COMPATIBILITY } from '../../functions/compatibility/function-names';
import { FUNCTION_NAMES_MATH } from '../../functions/math/function-names';
import type { Compare } from '../../functions/meta/compare/compare';
import { FUNCTION_NAMES_META } from '../../functions/meta/function-names';
import { IFunctionService } from '../../services/function.service';
import { LexerNode } from '../analysis/lexer-node';
import type { FunctionVariantType } from '../reference-object/base-reference-object';
import { BaseAstNode, ErrorNode } from './base-ast-node';
import { BaseAstNodeFactory, DEFAULT_AST_NODE_FACTORY_Z_INDEX } from './base-ast-node-factory';
import { NODE_ORDER_MAP, NodeType } from './node-type';

export class OperatorNode extends BaseAstNode {
    constructor(
        private _operatorString: string,
        private _functionExecutor: BaseFunction
    ) {
        super(_operatorString);
    }

    override get nodeType() {
        return NodeType.OPERATOR;
    }

    override execute() {
        const children = this.getChildren();
        if (this._functionExecutor.name === FUNCTION_NAMES_META.COMPARE) {
            (this._functionExecutor as Compare).setCompareType(this.getToken() as compareToken);
        }
        const object1 = children[0].getValue();
        const object2 = children[1].getValue();
        if (object1 == null || object2 == null) {
            throw new Error('object1 or object2 is null');
        }
        this.setValue(this._functionExecutor.calculate(object1, object2) as FunctionVariantType);
    }
}

export class OperatorNodeFactory extends BaseAstNodeFactory {
    constructor(@IFunctionService private readonly _functionService: IFunctionService) {
        super();
    }

    override get zIndex() {
        return NODE_ORDER_MAP.get(NodeType.OPERATOR) || DEFAULT_AST_NODE_FACTORY_Z_INDEX;
    }

    override create(param: string): BaseAstNode {
        let functionName = '';
        const tokenTrim = param;
        if (tokenTrim === operatorToken.PLUS) {
            functionName = FUNCTION_NAMES_META.PLUS;
        } else if (tokenTrim === operatorToken.MINUS) {
            functionName = FUNCTION_NAMES_META.MINUS;
        } else if (tokenTrim === operatorToken.MULTIPLY) {
            functionName = FUNCTION_NAMES_META.MULTIPLY;
        } else if (tokenTrim === operatorToken.DIVIDED) {
            functionName = FUNCTION_NAMES_META.DIVIDED;
        } else if (tokenTrim === operatorToken.CONCATENATE) {
            functionName = FUNCTION_NAMES_COMPATIBILITY.CONCATENATE;
        } else if (tokenTrim === operatorToken.POWER) {
            functionName = FUNCTION_NAMES_MATH.POWER;
        } else if (OPERATOR_TOKEN_COMPARE_SET.has(tokenTrim)) {
            functionName = FUNCTION_NAMES_META.COMPARE;
        }

        const functionExecutor = this._functionService.getExecutor(functionName);
        if (!functionExecutor) {
            console.error(`No function ${param}`);
            return ErrorNode.create(ErrorType.NAME);
        }
        return new OperatorNode(tokenTrim, functionExecutor);
    }

    override checkAndCreateNodeType(param: LexerNode | string) {
        if (param instanceof LexerNode) {
            return;
        }
        const tokenTrim = param.trim();

        if (tokenTrim.charAt(0) === '"' && tokenTrim.charAt(tokenTrim.length - 1) === '"') {
            return;
        }

        if (OPERATOR_TOKEN_SET.has(tokenTrim)) {
            return this.create(tokenTrim);
        }
    }
}
