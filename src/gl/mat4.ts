export const mat4 = {
 create(): Float32Array {
 return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
 },

 perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
 const f = 1.0 / Math.tan(fov / 2);
 const nf = 1 / (near - far);
 const out = new Float32Array(16);
 out[0] = f / aspect;
 out[5] = f;
 out[10] = (far + near) * nf;
 out[11] = -1;
 out[14] = 2 * far * near * nf;
 return out;
 },

 lookAt(eye: number[], center: number[], up: number[]): Float32Array {
 const zx = eye[0]-center[0], zy = eye[1]-center[1], zz = eye[2]-center[2];
 let len = 1/Math.sqrt(zx*zx+zy*zy+zz*zz);
 const z0=zx*len, z1=zy*len, z2=zz*len;
 const xx=up[1]*z2-up[2]*z1, xy=up[2]*z0-up[0]*z2, xz=up[0]*z1-up[1]*z0;
 len=1/Math.sqrt(xx*xx+xy*xy+xz*xz);
 const y0=z1*xz-z2*xy, y1=z2*xx-z0*xz, y2=z0*xy-z1*xx;
 const out = new Float32Array(16);
 out[0]=xx*len; out[1]=y0; out[2]=z0; out[3]=0;
 out[4]=xy*len; out[5]=y1; out[6]=z1; out[7]=0;
 out[8]=xz*len; out[9]=y2; out[10]=z2; out[11]=0;
 out[12]=-(xx*len*eye[0]+xy*len*eye[1]+xz*len*eye[2]);
 out[13]=-(y0*eye[0]+y1*eye[1]+y2*eye[2]);
 out[14]=-(z0*eye[0]+z1*eye[1]+z2*eye[2]);
 out[15]=1;
 return out;
 },

 multiply(a: Float32Array, b: Float32Array): Float32Array {
 const out = new Float32Array(16);
 for (let i = 0; i < 4; i++)
 for (let j = 0; j < 4; j++) {
 out[j*4+i] = a[i]*b[j*4]+a[4+i]*b[j*4+1]+a[8+i]*b[j*4+2]+a[12+i]*b[j*4+3];
 }
 return out;
 },

 translate(tx: number, ty: number, tz: number): Float32Array {
 const out = mat4.create();
 out[12]=tx; out[13]=ty; out[14]=tz;
 return out;
 },

 rotateX(angle: number): Float32Array {
 const c=Math.cos(angle), s=Math.sin(angle);
 const out = mat4.create();
 out[5]=c; out[6]=s; out[9]=-s; out[10]=c;
 return out;
 },

 rotateY(angle: number): Float32Array {
 const c=Math.cos(angle), s=Math.sin(angle);
 const out = mat4.create();
 out[0]=c; out[2]=-s; out[8]=s; out[10]=c;
 return out;
 },

 scale(sx: number, sy: number, sz: number): Float32Array {
 const out = mat4.create();
 out[0]=sx; out[5]=sy; out[10]=sz;
 return out;
 },
};
