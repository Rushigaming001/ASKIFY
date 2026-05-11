// using Deno.serve
import { encodeBase64 as base64Encode } from "jsr:@std/encoding/base64";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { checkDDoS } from "../_shared/ddos.ts";
import { errorResponse, installGlobalErrorHandlers } from "../_shared/errors.ts";
installGlobalErrorHandlers("minecraft-plugin");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ddos = checkDDoS(req, corsHeaders, { key: 'minecraft-plugin', limit: 10 });
  if (ddos) return ddos;

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for minecraft plugin restriction
    const { data: isRestricted } = await supabase.rpc('user_has_restriction', {
      _user_id: user.id,
      _restriction_type: 'minecraft_plugin_disabled'
    });

    if (isRestricted) {
      return new Response(JSON.stringify({ error: "Minecraft plugin generation is disabled for your account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, description, version, serverType, modLoader, addonType, commands, functionality, creationType = 'plugin' } = await req.json();
    
    console.log(`Generating Minecraft ${creationType} for user:`, user.id, { name, version, serverType, modLoader, addonType });

    // Use Lovable AI Gateway (no API key needed from user)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      // Fallback to GROQ if available
      const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
      if (!GROQ_API_KEY) {
        throw new Error('No AI API key configured');
      }
    }

    let systemPrompt = '';
    let userPrompt = '';

    if (creationType === 'addon') {
      systemPrompt = `You are an expert Minecraft Bedrock addon developer. Generate complete, production-ready addon files.

Generate a response in this EXACT JSON format (no markdown, no code blocks, just raw JSON):
{
  "manifest": "complete manifest.json content here",
  "behaviorFiles": {"path/to/file.json": "content here"},
  "resourceFiles": {"path/to/file.json": "content here"}
}

Requirements:
- Generate proper Bedrock addon structure
- Support Minecraft Bedrock ${version}
- Include proper UUID generation
- Follow Bedrock addon format specifications
- ${addonType === 'behavior' ? 'Focus on behavior pack files (entities, items, blocks, functions)' : ''}
- ${addonType === 'resource' ? 'Focus on resource pack files (textures, models, sounds, UI)' : ''}
- ${addonType === 'combined' ? 'Include both behavior and resource pack files' : ''}`;

      userPrompt = `Generate a Minecraft Bedrock addon with these specifications:

Addon Name: ${name}
Description: ${description}
Bedrock Version: ${version}
Addon Type: ${addonType} pack

Functionality:
${functionality}

Return ONLY valid JSON with manifest, behaviorFiles, and resourceFiles fields. No markdown formatting.`;
    } else if (creationType === 'mod') {
      const modInfo = getModInfo(modLoader);
      systemPrompt = `You are an expert Minecraft ${modLoader} mod developer. Generate complete, production-ready mod code.

Generate a response in this EXACT JSON format (no markdown, no code blocks, just raw JSON):
{
  "mainClass": "complete Java/Kotlin code here",
  "modConfig": "complete ${modInfo.configFile} content here",
  "packageName": "com.example.modname"
}

Requirements:
- Generate clean, well-documented code
- Use proper package structure
- Follow ${modLoader} mod standards
- Support Minecraft version ${version}
- Include proper ${modInfo.entryPoint}
- Add ${modInfo.dependencies} dependencies
- Follow ${modLoader} mod lifecycle`;

      userPrompt = `Generate a Minecraft ${modLoader} mod with these specifications:

Mod Name: ${name}
Description: ${description}
Minecraft Version: ${version}
Mod Loader: ${modLoader}

Commands:
${commands?.length > 0 ? commands.join('\n') : 'No specific commands'}

Functionality:
${functionality}

Return ONLY valid JSON with mainClass, modConfig, and packageName fields. No markdown formatting.`;
    } else {
      const pluginInfo = getPluginInfo(serverType);
      systemPrompt = `You are an expert Minecraft plugin developer. Generate complete, production-ready Java code.

Generate a response in this EXACT JSON format (no markdown, no code blocks, just raw JSON):
{
  "mainClass": "complete Java code here",
  "pluginYml": "complete ${pluginInfo.configFile} content here",
  "packageName": "com.example.pluginname"
}

Requirements:
- Generate clean, well-documented Java code
- Use proper package structure
- Follow best practices for ${serverType}
- Support Minecraft version ${version}
- The main class MUST extend ${pluginInfo.baseClass}
- Make code compatible with ${pluginInfo.apiType}
${pluginInfo.isProxy ? '- Implement proxy-specific features' : ''}`;

      userPrompt = `Generate a Minecraft plugin with these specifications:

Plugin Name: ${name}
Description: ${description}
Minecraft Version: ${version}
Server Software: ${serverType}

Commands:
${commands?.length > 0 ? commands.join('\n') : 'No specific commands'}

Functionality:
${functionality}

Return ONLY valid JSON with mainClass, pluginYml, and packageName fields. No markdown formatting.`;
    }

    // Try Lovable AI Gateway first
    let generatedContent: string | null = null;
    
    if (LOVABLE_API_KEY) {
      try {
        console.log("Using Lovable AI Gateway for code generation...");
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          generatedContent = data.choices?.[0]?.message?.content;
          console.log("Lovable AI response received");
        } else {
          console.log("Lovable AI Gateway failed:", response.status);
        }
      } catch (error) {
        console.log("Lovable AI Gateway error:", error);
      }
    }

    // Fallback to GROQ
    if (!generatedContent) {
      const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
      if (GROQ_API_KEY) {
        console.log("Falling back to GROQ API...");
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('GROQ error:', response.status, errorText);
          throw new Error(`AI API error: ${response.status}`);
        }

        const data = await response.json();
        generatedContent = data.choices?.[0]?.message?.content;
      }
    }

    if (!generatedContent) {
      throw new Error('No code generated from AI');
    }

    console.log("Raw AI response received, parsing...");

    // Clean markdown formatting if present
    generatedContent = generatedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse the JSON response
    let pluginData;
    try {
      pluginData = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Content that failed to parse:', generatedContent.substring(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }

    let fileContent: string;

    if (creationType === 'addon') {
      const { manifest, behaviorFiles, resourceFiles } = pluginData;
      if (!manifest) throw new Error('AI response missing manifest');
      fileContent = await createAddonPack(name, manifest, behaviorFiles || {}, resourceFiles || {}, addonType);
      console.log("Bedrock addon created successfully");
    } else {
      const { mainClass, pluginYml, modConfig, packageName } = pluginData;
      const configData = pluginYml || modConfig;
      
      if (!mainClass || !configData || !packageName) {
        throw new Error('AI response missing required fields');
      }
      
      fileContent = await createSourceJar(name, mainClass, configData, packageName, creationType);
      console.log(`${creationType} created successfully`);
    }

    // Log usage
    await supabase.from('usage_logs').insert({
      user_id: user.id,
      model_id: 'lovable-ai',
      mode: `minecraft-${creationType}`
    });

    return new Response(
      JSON.stringify({ fileBase64: fileContent }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    return errorResponse(error, { fn: "minecraft-plugin", corsHeaders });
  }
});

function getPluginInfo(serverType: string) {
  const isProxy = ['velocity', 'waterfall', 'bungeecord'].includes(serverType);
  
  return {
    apiType: isProxy ? `${serverType} Proxy API` : 'Bukkit/Spigot API',
    baseClass: serverType === 'velocity' ? '@Plugin annotation' : isProxy ? 'Plugin' : 'JavaPlugin',
    configFile: serverType === 'velocity' ? 'velocity-plugin.json' : isProxy ? 'bungee.yml' : 'plugin.yml',
    isProxy
  };
}

function getModInfo(modLoader: string) {
  const configs: Record<string, any> = {
    fabric: { configFile: 'fabric.mod.json', entryPoint: 'ModInitializer', dependencies: 'Fabric API' },
    forge: { configFile: 'mods.toml', entryPoint: '@Mod annotation', dependencies: 'Forge API' },
    neoforge: { configFile: 'mods.toml', entryPoint: '@Mod annotation', dependencies: 'NeoForge API' },
    quilt: { configFile: 'quilt.mod.json', entryPoint: 'ModInitializer', dependencies: 'Quilt API' },
    sponge: { configFile: 'sponge_plugins.json', entryPoint: '@Plugin annotation', dependencies: 'Sponge API' }
  };
  
  return configs[modLoader] || configs.fabric;
}

async function createAddonPack(
  name: string,
  manifest: string,
  behaviorFiles: Record<string, string>,
  resourceFiles: Record<string, string>,
  addonType: string
): Promise<string> {
  const encoder = new TextEncoder();
  let archiveContent = '';
  
  // Add manifest
  archiveContent += `\n\n========== manifest.json ==========\n\n${manifest}`;
  
  // Add behavior pack files
  if (addonType === 'behavior' || addonType === 'combined') {
    for (const [path, content] of Object.entries(behaviorFiles)) {
      archiveContent += `\n\n========== BP/${path} ==========\n\n${content}`;
    }
  }
  
  // Add resource pack files
  if (addonType === 'resource' || addonType === 'combined') {
    for (const [path, content] of Object.entries(resourceFiles)) {
      archiveContent += `\n\n========== RP/${path} ==========\n\n${content}`;
    }
  }
  
  const readme = `# ${name} - Bedrock Addon

This is a Minecraft Bedrock Edition addon generated by ASKIFY.

## Installation

1. Import the .mcpack file in Minecraft Bedrock Edition
2. Open Minecraft and go to Settings > Storage > Resource/Behavior Packs
3. Activate the addon in your world settings

Note: This is a source archive. Extract and compile if needed.
`;
  
  archiveContent += `\n\n========== README.md ==========\n\n${readme}`;
  
  const archiveBytes = encoder.encode(archiveContent);
  return base64Encode(archiveBytes.buffer);
}

async function createSourceJar(
  name: string,
  mainClass: string,
  configContent: string,
  packageName: string,
  creationType: string
): Promise<string> {
  const encoder = new TextEncoder();
  
  const packagePath = packageName.replace(/\./g, '/');
  const files = new Map<string, Uint8Array>();
  
  files.set(`src/main/java/${packagePath}/${name}.java`, encoder.encode(mainClass));
  
  const configPath = creationType === 'mod' ? 
    (configContent.includes('fabric') ? 'src/main/resources/fabric.mod.json' :
     configContent.includes('quilt') ? 'src/main/resources/quilt.mod.json' :
     'src/main/resources/META-INF/mods.toml') :
    'src/main/resources/plugin.yml';
    
  files.set(configPath, encoder.encode(configContent));
  
  const readme = `# ${name}

This is a Minecraft ${creationType} source package generated by ASKIFY.

## Building the ${creationType.charAt(0).toUpperCase() + creationType.slice(1)}

To build this into a .jar file:

1. Install Maven or Gradle
2. Extract this archive
3. Add a pom.xml or build.gradle file
4. Run: mvn clean package (Maven) or gradle build (Gradle)
5. Find the compiled .jar in target/ or build/libs/

## Quick Maven Setup

Create pom.xml:

\`\`\`xml
<project>
    <modelVersion>4.0.0</modelVersion>
    <groupId>${packageName}</groupId>
    <artifactId>${name}</artifactId>
    <version>1.0.0</version>
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.8.1</version>
                <configuration>
                    <source>1.8</source>
                    <target>1.8</target>
                </configuration>
            </plugin>
        </plugins>
    </build>
    <dependencies>
        <dependency>
            <groupId>org.spigotmc</groupId>
            <artifactId>spigot-api</artifactId>
            <version>1.20.1-R0.1-SNAPSHOT</version>
            <scope>provided</scope>
        </dependency>
    </dependencies>
    <repositories>
        <repository>
            <id>spigot-repo</id>
            <url>https://hub.spigotmc.org/nexus/content/repositories/snapshots/</url>
        </repository>
    </repositories>
</project>
\`\`\`

## Installation

1. Build the ${creationType} (see above)
2. Copy the .jar file to your ${creationType === 'plugin' ? 'server plugins' : 'mods'} folder
3. ${creationType === 'plugin' ? 'Restart your server' : 'Launch the game'}

Note: This is a source archive. You need to compile it before use.
`;
  files.set('README.md', encoder.encode(readme));
  
  let archiveContent = '';
  
  for (const [path, content] of files.entries()) {
    const contentStr = new TextDecoder().decode(content);
    archiveContent += `\n\n========== ${path} ==========\n\n${contentStr}`;
  }
  
  const archiveBytes = encoder.encode(archiveContent);
  return base64Encode(archiveBytes.buffer);
}