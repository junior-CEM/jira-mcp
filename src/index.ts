#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { JiraApiService } from "./services/jira-api.js";
import { JiraServerApiService } from "./services/jira-server-api.js";

declare module "bun" {
  interface Env {
    JIRA_API_TOKEN: string;
    JIRA_BASE_URL: string;
    JIRA_USER_EMAIL: string;
    JIRA_TYPE?: "cloud" | "server";
  }
}

const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_USER_EMAIL = process.env.JIRA_USER_EMAIL;
const JIRA_TYPE = (process.env.JIRA_TYPE === "server" ? "server" : "cloud") as
  | "cloud"
  | "server";

if (!JIRA_API_TOKEN || !JIRA_BASE_URL || !JIRA_USER_EMAIL) {
  throw new Error(
    "JIRA_API_TOKEN, JIRA_USER_EMAIL and JIRA_BASE_URL environment variables are required",
  );
}

class JiraServer {
  private server: Server;
  private jiraApi: JiraApiService;

  constructor() {
    this.server = new Server(
      {
        name: "jira-mcp",
        version: "0.2.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    if (JIRA_TYPE === "server") {
      this.jiraApi = new JiraServerApiService(
        JIRA_BASE_URL,
        JIRA_USER_EMAIL,
        JIRA_API_TOKEN,
      );
    } else {
      this.jiraApi = new JiraApiService(
        JIRA_BASE_URL,
        JIRA_USER_EMAIL,
        JIRA_API_TOKEN,
      );
    }

    this.setupToolHandlers();

    this.server.onerror = (error) => {};
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "search_issues",
          description: "Search JIRA issues using JQL",
          inputSchema: {
            type: "object",
            properties: {
              searchString: {
                type: "string",
                description: "JQL search string",
              },
            },
            required: ["searchString"],
            additionalProperties: false,
          },
        },
        {
          name: "get_epic_children",
          description:
            "Get all child issues in an epic including their comments",
          inputSchema: {
            type: "object",
            properties: {
              epicKey: {
                type: "string",
                description: "The key of the epic issue",
              },
            },
            required: ["epicKey"],
            additionalProperties: false,
          },
        },
        {
          name: "get_issue",
          description:
            "Get detailed information about a specific JIRA issue including comments",
          inputSchema: {
            type: "object",
            properties: {
              issueId: {
                type: "string",
                description: "The ID or key of the JIRA issue",
              },
            },
            required: ["issueId"],
            additionalProperties: false,
          },
        },
        {
          name: "create_issue",
          description: "Create a new JIRA issue",
          inputSchema: {
            type: "object",
            properties: {
              projectKey: {
                type: "string",
                description: "The project key where the issue will be created",
              },
              issueType: {
                type: "string",
                description:
                  'The type of issue to create (e.g., "Bug", "Story", "Task")',
              },
              summary: {
                type: "string",
                description: "The issue summary/title",
              },
              description: {
                type: "string",
                description: "The issue description",
              },
              fields: {
                type: "object",
                description: "Additional fields to set on the issue",
                additionalProperties: true,
              },
            },
            required: ["projectKey", "issueType", "summary"],
            additionalProperties: false,
          },
        },
        {
          name: "update_issue",
          description: "Update an existing JIRA issue",
          inputSchema: {
            type: "object",
            properties: {
              issueKey: {
                type: "string",
                description: "The key of the issue to update",
              },
              fields: {
                type: "object",
                description: "Fields to update on the issue",
                additionalProperties: true,
              },
            },
            required: ["issueKey", "fields"],
            additionalProperties: false,
          },
        },
        {
          name: "get_transitions",
          description: "Get available status transitions for a JIRA issue",
          inputSchema: {
            type: "object",
            properties: {
              issueKey: {
                type: "string",
                description: "The key of the issue to get transitions for",
              },
            },
            required: ["issueKey"],
            additionalProperties: false,
          },
        },
        {
          name: "transition_issue",
          description:
            "Change the status of a JIRA issue by performing a transition",
          inputSchema: {
            type: "object",
            properties: {
              issueKey: {
                type: "string",
                description: "The key of the issue to transition",
              },
              transitionId: {
                type: "string",
                description: "The ID of the transition to perform",
              },
              comment: {
                type: "string",
                description: "Optional comment to add with the transition",
              },
            },
            required: ["issueKey", "transitionId"],
            additionalProperties: false,
          },
        },
        {
          name: "add_attachment",
          description: "Add a file attachment to a JIRA issue",
          inputSchema: {
            type: "object",
            properties: {
              issueKey: {
                type: "string",
                description: "The key of the issue to add attachment to",
              },
              fileContent: {
                type: "string",
                description: "Base64 encoded content of the file",
              },
              filename: {
                type: "string",
                description: "Name of the file to be attached",
              },
            },
            required: ["issueKey", "fileContent", "filename"],
            additionalProperties: false,
          },
        },
        {
          name: "add_comment",
          description: "Add a comment to a JIRA issue",
          inputSchema: {
            type: "object",
            properties: {
              issueIdOrKey: {
                type: "string",
                description: "The ID or key of the issue to add the comment to",
              },
              body: {
                type: "string",
                description: "The content of the comment (plain text)",
              },
            },
            required: ["issueIdOrKey", "body"],
            additionalProperties: false,
          },
        },
        {
          name: "get_fields",
          description: "Get all available fields in the JIRA instance",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: "get_create_meta",
          description: "Get field metadata for creating issues in a project",
          inputSchema: {
            type: "object",
            properties: {
              projectKey: {
                type: "string",
                description: "The project key to get metadata for",
              },
              issueType: {
                type: "string",
                description: "Optional issue type to filter metadata",
              },
            },
            required: ["projectKey"],
            additionalProperties: false,
          },
        },
        {
          name: "get_edit_meta",
          description: "Get field metadata for editing a specific issue",
          inputSchema: {
            type: "object",
            properties: {
              issueKey: {
                type: "string",
                description: "The key of the issue to get edit metadata for",
              },
            },
            required: ["issueKey"],
            additionalProperties: false,
          },
        },
        {
          name: "find_story_points_field",
          description: "Find the story points field ID for a project and issue type",
          inputSchema: {
            type: "object",
            properties: {
              projectKey: {
                type: "string",
                description: "The project key to search in",
              },
              issueType: {
                type: "string",
                description: "The issue type (default: Story)",
                default: "Story",
              },
            },
            required: ["projectKey"],
            additionalProperties: false,
          },
        },
        {
          name: "update_story_points",
          description: "Update story points for a user story (automatically finds the correct field)",
          inputSchema: {
            type: "object",
            properties: {
              issueKey: {
                type: "string",
                description: "The key of the issue to update",
              },
              storyPoints: {
                type: "number",
                description: "The story points value to set",
              },
            },
            required: ["issueKey", "storyPoints"],
            additionalProperties: false,
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const args = request.params.arguments as Record<string, any>;

        switch (request.params.name) {
          case "search_issues": {
            if (!args.searchString || typeof args.searchString !== "string") {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Search string is required",
              );
            }
            const response = await this.jiraApi.searchIssues(args.searchString);
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "get_epic_children": {
            if (!args.epicKey || typeof args.epicKey !== "string") {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Epic key is required",
              );
            }
            const response = await this.jiraApi.getEpicChildren(args.epicKey);
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "get_issue": {
            if (!args.issueId || typeof args.issueId !== "string") {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Issue ID is required",
              );
            }
            const response = await this.jiraApi.getIssueWithComments(
              args.issueId,
            );
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "create_issue": {
            // Basic validation
            if (
              !args.projectKey ||
              typeof args.projectKey !== "string" ||
              !args.issueType ||
              typeof args.issueType !== "string" ||
              !args.summary ||
              typeof args.summary !== "string"
            ) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "projectKey, issueType, and summary are required",
              );
            }
            const response = await this.jiraApi.createIssue(
              args.projectKey,
              args.issueType,
              args.summary,
              args.description as string | undefined,
              args.fields as Record<string, any> | undefined,
            );
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "update_issue": {
            if (
              !args.issueKey ||
              typeof args.issueKey !== "string" ||
              !args.fields ||
              typeof args.fields !== "object"
            ) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "issueKey and fields object are required",
              );
            }
            await this.jiraApi.updateIssue(args.issueKey, args.fields);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    { message: `Issue ${args.issueKey} updated successfully` },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "get_transitions": {
            if (!args.issueKey || typeof args.issueKey !== "string") {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Issue key is required",
              );
            }
            const response = await this.jiraApi.getTransitions(args.issueKey);
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "transition_issue": {
            if (
              !args.issueKey ||
              typeof args.issueKey !== "string" ||
              !args.transitionId ||
              typeof args.transitionId !== "string"
            ) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "issueKey and transitionId are required",
              );
            }
            await this.jiraApi.transitionIssue(
              args.issueKey,
              args.transitionId,
              args.comment as string | undefined,
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      message: `Issue ${args.issueKey} transitioned successfully${args.comment ? " with comment" : ""}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "add_attachment": {
            if (
              !args.issueKey ||
              typeof args.issueKey !== "string" ||
              !args.fileContent ||
              typeof args.fileContent !== "string" ||
              !args.filename ||
              typeof args.filename !== "string"
            ) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "issueKey, fileContent, and filename are required",
              );
            }
            const fileBuffer = Buffer.from(args.fileContent, "base64");
            const result = await this.jiraApi.addAttachment(
              args.issueKey,
              fileBuffer,
              args.filename,
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      message: `File ${args.filename} attached successfully to issue ${args.issueKey}`,
                      attachmentId: result.id,
                      filename: result.filename,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "add_comment": {
            if (
              !args.issueIdOrKey ||
              typeof args.issueIdOrKey !== "string" ||
              !args.body ||
              typeof args.body !== "string"
            ) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "issueIdOrKey and body are required",
              );
            }
            const response = await this.jiraApi.addCommentToIssue(
              args.issueIdOrKey,
              args.body,
            );
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "get_fields": {
            const response = await this.jiraApi.getFields();
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "get_create_meta": {
            if (!args.projectKey || typeof args.projectKey !== "string") {
              throw new McpError(
                ErrorCode.InvalidParams,
                "projectKey is required",
              );
            }
            const response = await this.jiraApi.getCreateMeta(
              args.projectKey,
              args.issueType as string | undefined,
            );
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "get_edit_meta": {
            if (!args.issueKey || typeof args.issueKey !== "string") {
              throw new McpError(
                ErrorCode.InvalidParams,
                "issueKey is required",
              );
            }
            const response = await this.jiraApi.getEditMeta(args.issueKey);
            return {
              content: [
                { type: "text", text: JSON.stringify(response, null, 2) },
              ],
            };
          }
          case "find_story_points_field": {
            if (!args.projectKey || typeof args.projectKey !== "string") {
              throw new McpError(
                ErrorCode.InvalidParams,
                "projectKey is required",
              );
            }
            const response = await this.jiraApi.findStoryPointsField(
              args.projectKey,
              args.issueType as string | undefined,
            );
            return {
              content: [
                { 
                  type: "text", 
                  text: JSON.stringify({
                    projectKey: args.projectKey,
                    issueType: args.issueType || "Story",
                    storyPointsFieldId: response,
                    found: response !== null
                  }, null, 2) 
                },
              ],
            };
          }
          case "update_story_points": {
            if (
              !args.issueKey ||
              typeof args.issueKey !== "string" ||
              typeof args.storyPoints !== "number"
            ) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "issueKey and storyPoints are required",
              );
            }
            await this.jiraApi.updateStoryPoints(args.issueKey, args.storyPoints);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    { 
                      message: `Story points updated successfully for issue ${args.issueKey}`,
                      issueKey: args.issueKey,
                      storyPoints: args.storyPoints
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`,
            );
        }
      } catch (error) {
        // Keep generic error handling
        if (error instanceof McpError) {
          throw error;
        }
        
        // Enhanced error handling with user intervention signals
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        
        // Check if this is a JIRA API error that might need user attention
        if (errorMessage.includes("JIRA API Error")) {
          let guidanceMessage = "";
          
          if (errorMessage.includes("[AUTHENTICATION_ERROR]")) {
            guidanceMessage = "\n\n🔑 AUTHENTICATION ISSUE: Please verify your JIRA_API_TOKEN and JIRA_USER_EMAIL environment variables are correct.";
          } else if (errorMessage.includes("[PERMISSION_ERROR]")) {
            guidanceMessage = "\n\n🚫 PERMISSION ISSUE: Your account may not have sufficient permissions for this operation. Please check with your JIRA administrator.";
          } else if (errorMessage.includes("[NOT_FOUND_ERROR]")) {
            guidanceMessage = "\n\n❓ RESOURCE NOT FOUND: The requested issue, project, or resource does not exist or is not accessible.";
          } else if (errorMessage.includes("[VALIDATION_ERROR]")) {
            guidanceMessage = "\n\n📝 VALIDATION ERROR: The request data is invalid. Please check the field values and try again.";
          } else if (errorMessage.includes("[SERVER_ERROR]")) {
            guidanceMessage = "\n\n🏥 SERVER ERROR: JIRA server is experiencing issues. This may be temporary - consider retrying later.";
          } else {
            guidanceMessage = "\n\n⚠️ This error suggests there may be a configuration, permission, or data issue that requires manual review.";
          }
          
          // Add special markers to signal Claude should pause for user guidance
          const enhancedMessage = `🚨 JIRA API ERROR - USER INTERVENTION REQUIRED 🚨\n\n${errorMessage}${guidanceMessage}\n\n⏸️ Please review the error details above and provide guidance on how to proceed.`;
          
          throw new McpError(
            ErrorCode.InternalError,
            enhancedMessage,
          );
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          errorMessage,
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    // JIRA MCP server running on stdio
  }
}

const server = new JiraServer();
server.run().catch(() => {});
