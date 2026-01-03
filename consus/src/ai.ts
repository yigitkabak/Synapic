import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS = [
      "meta-llama/llama-3.1-405b-instruct:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
      "qwen/qwen3-235b-a22b:free",
      "openai/gpt-oss-120b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "deepseek/deepseek-r1-0528:free",
      "google/gemini-2.0-flash-exp:free",
      "z-ai/glm-4.5-air:free",
      "google/gemma-3-27b-it:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "alibaba/tongyi-deepresearch-30b-a3b:free",
      "allenai/olmo-3.1-32b-think:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
      "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
      "openai/gpt-oss-20b:free",
      "mistralai/devstral-2512:free",
      "kwaipilot/kat-coder-pro:free",
      "qwen/qwen3-coder:free",
      "google/gemma-3-12b-it:free",
      "nvidia/nemotron-nano-12b-v2-vl:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "nex-agi/deepseek-v3.1-nex-n1:free",
      "moonshotai/kimi-k2:free",
      "tngtech/deepseek-r1t2-chimera:free",
      "tngtech/deepseek-r1t-chimera:free",
      "tngtech/tng-r1t-chimera:free",
      "mistralai/mistral-7b-instruct:free",
      "qwen/qwen-2.5-vl-7b-instruct:free",
      "amazon/nova-2-lite-v1",
      "xiaomi/mimo-v2-flash:free",
      "google/gemma-3-4b-it:free",
      "google/gemma-3n-e4b-it:free",
      "qwen/qwen3-4b:free",
      "meta-llama/llama-3.2-3b-instruct:free",
      "google/gemma-3n-e2b-it:free",
      "arcee-ai/trinity-mini:free"
];

export const fetchOpenRouterResponse = async (query: string): Promise<string> => {
    
    for (const model of MODELS) {
        try {
            const response = await axios.post(
                API_URL,
                {
                    model: model,
                    messages: [
                        { 
                            role: "system", 
                            content: "You are a helpful assistant. You must answer in the same language as the user's query. If the user asks in Turkish, answer in Turkish." 
                        },
                        { 
                            role: "user", 
                            content: query 
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000,
                },
                {
                    headers: {
                        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:3000",
                        "X-Title": "Consus"
                    },
                    timeout: 5000
                }
            );
            if (response.data && response.data.choices && response.data.choices.length > 0) {
                return response.data.choices[0].message.content;
            }

        } catch (error: any) {
            continue;
        }
    }

    return "I'm sorry, all free AI models are currently busy or unable to respond. Please try again shortly.";
};