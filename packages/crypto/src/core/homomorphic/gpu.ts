/**
 * GPU acceleration for homomorphic operations using WebGL
 */
import { FHECiphertext, FHEParams } from './fhe';

export class GPUAccelerator {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private params: FHEParams;

  constructor(params: FHEParams) {
    this.params = params;
    
    // Initialize WebGL context
    const canvas = document.createElement('canvas');
    this.gl = canvas.getContext('webgl') as WebGLRenderingContext;
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    // Initialize shaders
    this.program = this.createProgram();
    this.gl.useProgram(this.program);
  }

  /**
   * Parallel polynomial multiplication using GPU
   */
  public async multiplyPolynomials(a: bigint[], b: bigint[]): Promise<bigint[]> {
    const n = this.params.n;
    
    // Convert polynomials to texture data
    const aData = this.polynomialToTextureData(a);
    const bData = this.polynomialToTextureData(b);
    
    // Create and bind textures
    const texA = this.createTexture(aData, n);
    const texB = this.createTexture(bData, n);
    
    // Set up framebuffer for output
    const framebuffer = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    
    // Create output texture
    const outputTex = this.createTexture(new Float32Array(n * 4), n);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      outputTex,
      0
    );
    
    // Set uniforms
    const uTexA = this.gl.getUniformLocation(this.program, 'uTexA');
    const uTexB = this.gl.getUniformLocation(this.program, 'uTexB');
    const uN = this.gl.getUniformLocation(this.program, 'uN');
    const uQ = this.gl.getUniformLocation(this.program, 'uQ');
    
    this.gl.uniform1i(uTexA, 0);
    this.gl.uniform1i(uTexB, 1);
    this.gl.uniform1i(uN, n);
    this.gl.uniform1f(uQ, Number(this.params.q));
    
    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    
    // Read result
    const result = new Float32Array(n * 4);
    this.gl.readPixels(0, 0, n, 1, this.gl.RGBA, this.gl.FLOAT, result);
    
    // Convert back to polynomial
    return this.textureDataToPolynomial(result);
  }

  /**
   * Parallel NTT transform using GPU
   */
  public async ntt(poly: bigint[], inverse: boolean = false): Promise<bigint[]> {
    const n = this.params.n;
    
    // Convert polynomial to texture data
    const polyData = this.polynomialToTextureData(poly);
    
    // Create and bind input texture
    const texPoly = this.createTexture(polyData, n);
    
    // Set up framebuffer for output
    const framebuffer = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    
    // Create output texture
    const outputTex = this.createTexture(new Float32Array(n * 4), n);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      outputTex,
      0
    );
    
    // Set uniforms
    const uTex = this.gl.getUniformLocation(this.program, 'uTex');
    const uN = this.gl.getUniformLocation(this.program, 'uN');
    const uInverse = this.gl.getUniformLocation(this.program, 'uInverse');
    
    this.gl.uniform1i(uTex, 0);
    this.gl.uniform1i(uN, n);
    this.gl.uniform1i(uInverse, inverse ? 1 : 0);
    
    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    
    // Read result
    const result = new Float32Array(n * 4);
    this.gl.readPixels(0, 0, n, 1, this.gl.RGBA, this.gl.FLOAT, result);
    
    // Convert back to polynomial
    return this.textureDataToPolynomial(result);
  }

  /**
   * Parallel polynomial addition using GPU
   */
  public async addPolynomials(a: bigint[], b: bigint[]): Promise<bigint[]> {
    const n = this.params.n;
    
    // Convert polynomials to texture data
    const aData = this.polynomialToTextureData(a);
    const bData = this.polynomialToTextureData(b);
    
    // Create and bind textures
    const texA = this.createTexture(aData, n);
    const texB = this.createTexture(bData, n);
    
    // Set up framebuffer for output
    const framebuffer = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    
    // Create output texture
    const outputTex = this.createTexture(new Float32Array(n * 4), n);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      outputTex,
      0
    );
    
    // Set uniforms
    const uTexA = this.gl.getUniformLocation(this.program, 'uTexA');
    const uTexB = this.gl.getUniformLocation(this.program, 'uTexB');
    const uN = this.gl.getUniformLocation(this.program, 'uN');
    const uQ = this.gl.getUniformLocation(this.program, 'uQ');
    
    this.gl.uniform1i(uTexA, 0);
    this.gl.uniform1i(uTexB, 1);
    this.gl.uniform1i(uN, n);
    this.gl.uniform1f(uQ, Number(this.params.q));
    
    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    
    // Read result
    const result = new Float32Array(n * 4);
    this.gl.readPixels(0, 0, n, 1, this.gl.RGBA, this.gl.FLOAT, result);
    
    // Convert back to polynomial
    return this.textureDataToPolynomial(result);
  }

  private createProgram(): WebGLProgram {
    // Vertex shader
    const vsSource = `
      attribute vec2 aPosition;
      varying vec2 vTexCoord;
      
      void main() {
        vTexCoord = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    // Fragment shader for polynomial multiplication
    const fsSource = `
      precision highp float;
      uniform sampler2D uTexA;
      uniform sampler2D uTexB;
      uniform int uN;
      uniform float uQ;
      varying vec2 vTexCoord;
      
      void main() {
        vec4 a = texture2D(uTexA, vTexCoord);
        vec4 b = texture2D(uTexB, vTexCoord);
        vec4 result = mod(a * b, uQ);
        gl_FragColor = result;
      }
    `;

    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fsSource);

    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error('Unable to initialize the shader program');
    }

    return program;
  }

  private createShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error('An error occurred compiling the shaders');
    }

    return shader;
  }

  private createTexture(data: Float32Array, size: number): WebGLTexture {
    const texture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      size,
      1,
      0,
      this.gl.RGBA,
      this.gl.FLOAT,
      data
    );
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    return texture;
  }

  private polynomialToTextureData(poly: bigint[]): Float32Array {
    const data = new Float32Array(poly.length * 4);
    for (let i = 0; i < poly.length; i++) {
      const val = Number(poly[i]);
      data[i * 4] = val;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 1;
    }
    return data;
  }

  private textureDataToPolynomial(data: Float32Array): bigint[] {
    const poly: bigint[] = [];
    for (let i = 0; i < data.length; i += 4) {
      poly.push(BigInt(Math.round(data[i])));
    }
    return poly;
  }

  public dispose(): void {
    this.gl.deleteProgram(this.program);
  }
} 