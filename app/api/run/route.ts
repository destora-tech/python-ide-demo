import { NextResponse, NextRequest } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    
    // Create a unique temporary filename
    const filename = `temp_${Date.now()}.py`;
    const filePath = path.join(process.cwd(), filename);
    
    // Write the user's code to the temporary file
    fs.writeFileSync(filePath, code);

    return new Promise<NextResponse>((resolve) => {
      // Use 'python3' or 'python' depending on your local machine environment
      // Setting a strict 5-second timeout execution window
// Adding env: { PYTHONIOENCODING: 'utf-8' } ensures Windows can print emojis and symbols safely
      exec(`python3 ${filePath}`, { timeout: 5000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }, (error, stdout, stderr) => {        // Clean up and delete the temporary file immediately after execution
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        if (error && error.killed) {
          resolve(NextResponse.json({ output: 'Error: Execution timed out (5s limit).' }));
        } else if (stderr) {
          resolve(NextResponse.json({ output: stderr }));
        } else {
          resolve(NextResponse.json({ output: stdout || 'Code executed successfully with no output.' }));
        }
      });
    });

 } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ output: `Server Error: ${errorMessage}` }, { status: 500 });
  }
}