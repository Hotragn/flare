// The live flame shader. GLSL ES 1.00, so it runs in WebGL 1 and WebGL 2.
// It never draws its own fire shape: it samples the brand pin-flame silhouette
// (FLAME with its round hole, DOME, the Gone ring and smoke) from a mask texture
// and only bends the part above the hole with noise. The hole never moves.
// Coordinates are brand units: the 0..100 viewBox, with the canvas covering
// x -20..120 and y -30..110 so the glow and the smoke have room.
// Mask channels: r = flame, g = ember dome, b = Gone mark, a = wide blur of the flame.
export const VERT = `attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}`;

export const FRAG = `precision mediump float;
varying vec2 v;
uniform sampler2D M;
uniform float t,sc,sy,heat,lit,pulse,emb,dome,gone,drift,edge;
uniform vec3 cB,cE,cS,cD;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}
vec4 m(vec2 q){return texture2D(M,(q+vec2(20.,30.))/140.);}
float cut(float x){return smoothstep(.5-edge,.5+edge,x);}
void main(){
vec2 p=vec2(v.x*140.-20.,110.-v.y*140.),B=vec2(50.,96.);
vec2 q=B+(p-B)/vec2(sc,sc*sy);
float w=smoothstep(.45,1.,clamp((96.-q.y)/92.,0.,1.))*heat;
vec2 o=vec2(fbm(vec2(q.y*.045-t*1.9,t*.35))-.5,(fbm(vec2(q.x*.05+3.,q.y*.04-t*1.4))-.5)*.5)*10.*w;
float f=cut(m(q+o).r)*(1.-emb);
vec2 C=vec2(50.,58.);
float core=smoothstep(.3,.75,m(C+(q+o*1.6-C)/.5).r)*smoothstep(67.,50.,q.y)*(.75+.4*fbm(q*.05+vec2(0.,t*1.2)));
vec3 col=mix(cB,cD,clamp(core*.45*heat,0.,1.));
float r=6.*sc*lit*(1.+.18*pulse);
float d=(1.-smoothstep(r-.35,r+.35,length(p-B-(vec2(50.,67.)-B)*vec2(sc,sc*sy))))*(1.-emb)*min(1.,lit*4.);
vec2 qd=vec2(p.x,95.+(p.y-95.)/dome);
float br=.93+.07*sin(t*1.96);
float e=cut(m(qd).g)*emb*(1.-gone);
vec2 qg=p+vec2(4.,-6.)*drift;
float sw=smoothstep(80.,10.,qg.y);
qg.x+=(fbm(vec2(qg.y*.06-t*.5,t*.2))-.5)*7.*sw;
float g=cut(m(qg).b)*gone*(1.-drift)*(1.-.3*sw);
float eh=smoothstep(1.,.35,length((p-vec2(50.,84.))/vec2(44.,22.*dome)));
float halo=m(q).a*(.18*heat*(1.-emb)+.45*pulse)*smoothstep(12.,15.,length(q-vec2(50.,67.)))+eh*.3*br*emb*(1.-gone)*smoothstep(8.,11.,length(qd-vec2(50.,81.)));
vec3 ce=mix(cE,cB,.55*smoothstep(30.,4.,length((p-vec2(50.,70.))*vec2(1.,1.6)))*(.6+.4*sin(t*1.96)));
vec3 c=col*f;float a=f;
c+=cD*d*(1.-a);a+=d*(1.-a);
c+=ce*e*(1.-a);a+=e*(1.-a);
c+=cS*g*(1.-a);a+=g*(1.-a);
halo*=1.-a;
gl_FragColor=vec4(c+cD*halo,a+halo);
}`;
