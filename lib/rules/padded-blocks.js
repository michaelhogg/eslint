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

/**
 * @see astexplorer.net
 * @see github.com/typescript-eslint/typescript-eslint/blob/v4.1.0/packages/types/src/ast-node-types.ts
 * @see github.com/jquery/esprima/blob/d277380/src/syntax.ts
 * @see esprima.readthedocs.io/en/latest/syntax-tree-format.html
 * @see babeljs.io/docs/en/babel-types
 */
const blockOptionKeysAndNodeTypes = [
    { optionKey: "ifsAndElses",          nodeType: "IfStatement"             },
    { optionKey: "forLoops",             nodeType: "ForStatement"            },
    { optionKey: "forInLoops",           nodeType: "ForInStatement"          },
    { optionKey: "forOfLoops",           nodeType: "ForOfStatement"          },
    { optionKey: "whileLoops",           nodeType: "WhileStatement"          },
    { optionKey: "doWhileLoops",         nodeType: "DoWhileStatement"        },
    { optionKey: "functionDeclarations", nodeType: "FunctionDeclaration"     },
    { optionKey: "functionExpressions",  nodeType: "FunctionExpression"      },
    { optionKey: "arrowFunctions",       nodeType: "ArrowFunctionExpression" },
    { optionKey: "trys",                 nodeType: "TryStatement"            },
    { optionKey: "catches",              nodeType: "CatchClause"             }
];

const nonblockOptionKeysAndNodeTypes = [
    { optionKey: "objects",    nodeType: "ObjectExpression", nonemptyAttribute: "properties" },
    { optionKey: "switches",   nodeType: "SwitchStatement",  nonemptyAttribute: "cases"      },
    { optionKey: "classes",    nodeType: "ClassBody",        nonemptyAttribute: "body"       },
    { optionKey: "interfaces", nodeType: "TSInterfaceBody",  nonemptyAttribute: "body"       }
];

const allBlockOptionKeys = [
    "blocks",                                               // BlockStatement (includes all block subtypes)
    ...blockOptionKeysAndNodeTypes.map((b) => b.optionKey)  // Option keys of block subtypes
];

const allNonblockOptionKeys = nonblockOptionKeysAndNodeTypes.map((b) => b.optionKey);

const allOptionKeys = [
    ...allBlockOptionKeys,
    ...allNonblockOptionKeys
];

function generatePropertiesForSchema() {
    const properties = {};

    for (const key of allOptionKeys) {
        properties[key] = {
            enum: ["always", "never"]
        };
    }

    return properties;
}

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
                        properties: generatePropertiesForSchema(),
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

        if (typeof typeOptions === "string") {
            const shouldHavePadding = typeOptions === "always";

            for (const key of allOptionKeys) {
                options[key] = shouldHavePadding;
            }
        } else {
            for (const key of allOptionKeys) {
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
         * Checks if the given node's parent is of the specified type.
         * @param {ASTNode} node The AST node to check.
         * @param {string} nodeType The node type to check against.
         * @returns {boolean} Whether or not the node's parent is of the specified type.
         */
        function isNodeParentType(node, nodeType) {
            return (node.parent.type === nodeType);
        }

        /**
         * Checks if a node should be padded, according to the rule config.
         * @param {ASTNode} node The AST node to check.
         * @returns {boolean} True if the node should be padded, false otherwise.
         */
        function requirePaddingFor(node) {
            switch (node.type) {
                case "BlockStatement":
                    for (const b of blockOptionKeysAndNodeTypes) {
                        if (isNodeParentType(node, b.nodeType)) {
                            return options[b.optionKey];
                        }
                    }
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

        /**
         * Checks if the option with the specified key has been configured.
         * @param {string} key The option key to check.
         * @returns {boolean} Whether or not the option has been configured.
         */
        function isOptionConfigured(key) {
            return Object.prototype.hasOwnProperty.call(options, key);
        }

        for (const nb of nonblockOptionKeysAndNodeTypes) {
            if (isOptionConfigured(nb.optionKey)) {
                rule[nb.nodeType] = function(node) {
                    if (node[nb.nonemptyAttribute].length === 0) {
                        return;
                    }
                    checkPadding(node);
                };
            }
        }

        const shouldCreateBlockRule = allBlockOptionKeys.some((key) => isOptionConfigured(key));

        if (shouldCreateBlockRule) {
            rule.BlockStatement = function(node) {
                if (node.body.length === 0) {
                    return;
                }
                const proceedToCheck = isOptionConfigured("blocks") || blockOptionKeysAndNodeTypes.some((b) =>
                    isOptionConfigured(b.optionKey) && isNodeParentType(node, b.nodeType)
                );
                if (proceedToCheck) {
                    checkPadding(node);
                }
            };
        }

        return rule;
    }
};
