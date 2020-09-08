/**
 * @fileoverview A rule to ensure blank lines within blocks.
 * @author Mathias Schreck <https://github.com/lo1tuma>
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const astUtils = require("./utils/ast-utils");

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
    meta: {
        type: "layout",

        docs: {
            description: "require or disallow padding within blocks",
            category: "Stylistic Issues",
            recommended: false,
            url: "https://eslint.org/docs/rules/padded-blocks"
        },

        fixable: "whitespace",

        schema: [
            {
                oneOf: [
                    {
                        enum: ["always", "never"]
                    },
                    {
                        type: "object",
                        properties: {
                            blocks: {
                                enum: ["always", "never"]
                            },
                            switches: {
                                enum: ["always", "never"]
                            },
                            objects: {
                                enum: ["always", "never"]
                            },
                            ifsAndElses: {
                                enum: ["always", "never"]
                            },
                            forLoops: {
                                enum: ["always", "never"]
                            },
                            forInLoops: {
                                enum: ["always", "never"]
                            },
                            forOfLoops: {
                                enum: ["always", "never"]
                            },
                            whileLoops: {
                                enum: ["always", "never"]
                            },
                            doWhileLoops: {
                                enum: ["always", "never"]
                            },
                            functionDeclarations: {
                                enum: ["always", "never"]
                            },
                            functionExpressions: {
                                enum: ["always", "never"]
                            },
                            arrowFunctions: {
                                enum: ["always", "never"]
                            },
                            trys: {
                                enum: ["always", "never"]
                            },
                            catches: {
                                enum: ["always", "never"]
                            },
                            interfaces: {
                                enum: ["always", "never"]
                            },
                            classes: {
                                enum: ["always", "never"]
                            }
                        },
                        additionalProperties: false,
                        minProperties: 1
                    }
                ]
            },
            {
                type: "object",
                properties: {
                    allowSingleLineBlocks: {
                        type: "boolean"
                    }
                },
                additionalProperties: false
            }
        ],

        messages: {
            alwaysPadBlock: "Block must be padded by blank lines.",
            neverPadBlock: "Block must not be padded by blank lines."
        }
    },

    create(context) {
        const options = {};
        const typeOptions = context.options[0] || "always";
        const exceptOptions = context.options[1] || {};

        const possibleKeys = [
            "blocks",
            "switches",
            "objects",
            "ifsAndElses",
            "forLoops",
            "forInLoops",
            "forOfLoops",
            "whileLoops",
            "doWhileLoops",
            "functionDeclarations",
            "functionExpressions",
            "arrowFunctions",
            "trys",
            "catches",
            "interfaces",
            "classes"
        ];

        if (typeof typeOptions === "string") {
            const shouldHavePadding = typeOptions === "always";

            for (const key of possibleKeys) {
                options[key] = shouldHavePadding;
            }
        } else {
            for (const key of possibleKeys) {
                if (Object.prototype.hasOwnProperty.call(typeOptions, key)) {
                    options[key] = (typeOptions[key] === "always");
                }
            }
        }

        if (Object.prototype.hasOwnProperty.call(exceptOptions, "allowSingleLineBlocks")) {
            options.allowSingleLineBlocks = exceptOptions.allowSingleLineBlocks === true;
        }

        const sourceCode = context.getSourceCode();

        /**
         * Gets the open brace token from a given node.
         * @param {ASTNode} node A BlockStatement or SwitchStatement node from which to get the open brace.
         * @returns {Token} The token of the open brace.
         */
        function getOpenBrace(node) {
            if (node.type === "SwitchStatement") {
                return sourceCode.getTokenBefore(node.cases[0]);
            }
            return sourceCode.getFirstToken(node);
        }

        /**
         * Checks if the given parameter is a comment node
         * @param {ASTNode|Token} node An AST node or token
         * @returns {boolean} True if node is a comment
         */
        function isComment(node) {
            return node.type === "Line" || node.type === "Block";
        }

        /**
         * Checks if there is padding between two tokens
         * @param {Token} first The first token
         * @param {Token} second The second token
         * @returns {boolean} True if there is at least a line between the tokens
         */
        function isPaddingBetweenTokens(first, second) {
            return second.loc.start.line - first.loc.end.line >= 2;
        }


        /**
         * Checks if the given token has a blank line after it.
         * @param {Token} token The token to check.
         * @returns {boolean} Whether or not the token is followed by a blank line.
         */
        function getFirstBlockToken(token) {
            let prev,
                first = token;

            do {
                prev = first;
                first = sourceCode.getTokenAfter(first, { includeComments: true });
            } while (isComment(first) && first.loc.start.line === prev.loc.end.line);

            return first;
        }

        /**
         * Checks if the given token is preceded by a blank line.
         * @param {Token} token The token to check
         * @returns {boolean} Whether or not the token is preceded by a blank line
         */
        function getLastBlockToken(token) {
            let last = token,
                next;

            do {
                next = last;
                last = sourceCode.getTokenBefore(last, { includeComments: true });
            } while (isComment(last) && last.loc.end.line === next.loc.start.line);

            return last;
        }

        /**
         * @see astexplorer.net
         * @see github.com/typescript-eslint/typescript-eslint/blob/v3.5.0/packages/types/src/ast-node-types.ts
         * @see github.com/jquery/esprima/blob/d277380/src/syntax.ts
         * @see esprima.readthedocs.io/en/latest/syntax-tree-format.html
         * @see babeljs.io/docs/en/babel-types
         */
        const isBlockIfElse      = (node) => (node.parent.type === "IfStatement");
        const isBlockForLoop     = (node) => (node.parent.type === "ForStatement");
        const isBlockForInLoop   = (node) => (node.parent.type === "ForInStatement");
        const isBlockForOfLoop   = (node) => (node.parent.type === "ForOfStatement");
        const isBlockWhileLoop   = (node) => (node.parent.type === "WhileStatement");
        const isBlockDoWhileLoop = (node) => (node.parent.type === "DoWhileStatement");
        const isBlockFunDec      = (node) => (node.parent.type === "FunctionDeclaration");
        const isBlockFunExp      = (node) => (node.parent.type === "FunctionExpression");
        const isBlockArrowFun    = (node) => (node.parent.type === "ArrowFunctionExpression");
        const isBlockTry         = (node) => (node.parent.type === "TryStatement");
        const isBlockCatch       = (node) => (node.parent.type === "CatchClause");

        /**
         * Checks if a node should be padded, according to the rule config.
         * @param {ASTNode} node The AST node to check.
         * @returns {boolean} True if the node should be padded, false otherwise.
         */
        function requirePaddingFor(node) {
            switch (node.type) {
                case "BlockStatement":
                    if (isBlockIfElse(node))      { return options.ifsAndElses;          }
                    if (isBlockForLoop(node))     { return options.forLoops;             }
                    if (isBlockForInLoop(node))   { return options.forInLoops;           }
                    if (isBlockForOfLoop(node))   { return options.forOfLoops;           }
                    if (isBlockWhileLoop(node))   { return options.whileLoops;           }
                    if (isBlockDoWhileLoop(node)) { return options.doWhileLoops;         }
                    if (isBlockFunDec(node))      { return options.functionDeclarations; }
                    if (isBlockFunExp(node))      { return options.functionExpressions;  }
                    if (isBlockArrowFun(node))    { return options.arrowFunctions;       }
                    if (isBlockTry(node))         { return options.trys;                 }
                    if (isBlockCatch(node))       { return options.catches;              }
                    return options.blocks;
                case "ObjectExpression":
                    return options.objects;
                case "SwitchStatement":
                    return options.switches;
                case "TSInterfaceBody":
                    return options.interfaces;
                case "ClassBody":
                    return options.classes;

                /* istanbul ignore next */
                default:
                    throw new Error("unreachable");
            }
        }

        /**
         * Checks the given BlockStatement node to be padded if the block is not empty.
         * @param {ASTNode} node The AST node of a BlockStatement.
         * @returns {void} undefined.
         */
        function checkPadding(node) {
            const openBrace = getOpenBrace(node),
                firstBlockToken = getFirstBlockToken(openBrace),
                tokenBeforeFirst = sourceCode.getTokenBefore(firstBlockToken, { includeComments: true }),
                closeBrace = sourceCode.getLastToken(node),
                lastBlockToken = getLastBlockToken(closeBrace),
                tokenAfterLast = sourceCode.getTokenAfter(lastBlockToken, { includeComments: true }),
                blockHasTopPadding = isPaddingBetweenTokens(tokenBeforeFirst, firstBlockToken),
                blockHasBottomPadding = isPaddingBetweenTokens(lastBlockToken, tokenAfterLast);

            if (options.allowSingleLineBlocks && astUtils.isTokenOnSameLine(tokenBeforeFirst, tokenAfterLast)) {
                return;
            }

            if (requirePaddingFor(node)) {

                if (!blockHasTopPadding) {
                    context.report({
                        node,
                        loc: {
                            start: tokenBeforeFirst.loc.start,
                            end: firstBlockToken.loc.start
                        },
                        fix(fixer) {
                            return fixer.insertTextAfter(tokenBeforeFirst, "\n");
                        },
                        messageId: "alwaysPadBlock"
                    });
                }
                if (!blockHasBottomPadding) {
                    context.report({
                        node,
                        loc: {
                            end: tokenAfterLast.loc.start,
                            start: lastBlockToken.loc.end
                        },
                        fix(fixer) {
                            return fixer.insertTextBefore(tokenAfterLast, "\n");
                        },
                        messageId: "alwaysPadBlock"
                    });
                }
            } else {
                if (blockHasTopPadding) {

                    context.report({
                        node,
                        loc: {
                            start: tokenBeforeFirst.loc.start,
                            end: firstBlockToken.loc.start
                        },
                        fix(fixer) {
                            return fixer.replaceTextRange([tokenBeforeFirst.range[1], firstBlockToken.range[0] - firstBlockToken.loc.start.column], "\n");
                        },
                        messageId: "neverPadBlock"
                    });
                }

                if (blockHasBottomPadding) {

                    context.report({
                        node,
                        loc: {
                            end: tokenAfterLast.loc.start,
                            start: lastBlockToken.loc.end
                        },
                        messageId: "neverPadBlock",
                        fix(fixer) {
                            return fixer.replaceTextRange([lastBlockToken.range[1], tokenAfterLast.range[0] - tokenAfterLast.loc.start.column], "\n");
                        }
                    });
                }
            }
        }

        const rule = {};

        if (Object.prototype.hasOwnProperty.call(options, "objects")) {
            rule.ObjectExpression = function(node) {
                if (node.properties.length === 0) {
                    return;
                }
                checkPadding(node);
            };
        }

        if (Object.prototype.hasOwnProperty.call(options, "switches")) {
            rule.SwitchStatement = function(node) {
                if (node.cases.length === 0) {
                    return;
                }
                checkPadding(node);
            };
        }

        const isOptSet = (key) => Object.prototype.hasOwnProperty.call(options, key);

        const checkBlocks       = isOptSet("blocks");
        const checkIfElses      = isOptSet("ifsAndElses");
        const checkForLoops     = isOptSet("forLoops");
        const checkForInLoops   = isOptSet("forInLoops");
        const checkForOfLoops   = isOptSet("forOfLoops");
        const checkWhileLoops   = isOptSet("whileLoops");
        const checkDoWhileLoops = isOptSet("doWhileLoops");
        const checkFunDecs      = isOptSet("functionDeclarations");
        const checkFunExps      = isOptSet("functionExpressions");
        const checkArrowsFuns   = isOptSet("arrowFunctions");
        const checkTrys         = isOptSet("trys");
        const checkCatches      = isOptSet("catches");

        const shouldCreateBlockRule = (
            checkBlocks       ||
            checkIfElses      ||
            checkForLoops     ||
            checkForInLoops   ||
            checkForOfLoops   ||
            checkWhileLoops   ||
            checkDoWhileLoops ||
            checkFunDecs      ||
            checkFunExps      ||
            checkArrowsFuns   ||
            checkTrys         ||
            checkCatches
        );

        if (shouldCreateBlockRule) {
            rule.BlockStatement = function(node) {
                if (node.body.length === 0) {
                    return;
                }
                const proceedToCheck = (
                    (checkBlocks)                                   ||
                    (checkIfElses      && isBlockIfElse(node))      ||
                    (checkForLoops     && isBlockForLoop(node))     ||
                    (checkForInLoops   && isBlockForInLoop(node))   ||
                    (checkForOfLoops   && isBlockForOfLoop(node))   ||
                    (checkWhileLoops   && isBlockWhileLoop(node))   ||
                    (checkDoWhileLoops && isBlockDoWhileLoop(node)) ||
                    (checkFunDecs      && isBlockFunDec(node))      ||
                    (checkFunExps      && isBlockFunExp(node))      ||
                    (checkArrowsFuns   && isBlockArrowFun(node))    ||
                    (checkTrys         && isBlockTry(node))         ||
                    (checkCatches      && isBlockCatch(node))
                );
                if (proceedToCheck) {
                    checkPadding(node);
                }
            };
        }

        if (Object.prototype.hasOwnProperty.call(options, "classes")) {
            rule.ClassBody = function(node) {
                if (node.body.length === 0) {
                    return;
                }
                checkPadding(node);
            };
        }

        if (Object.prototype.hasOwnProperty.call(options, "interfaces")) {
            rule.TSInterfaceBody = function(node) {
                if (node.body.length === 0) {
                    return;
                }
                checkPadding(node);
            };
        }

        return rule;
    }
};
