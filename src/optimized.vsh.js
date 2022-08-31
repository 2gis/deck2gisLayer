export default "precision mediump float;\n#define GLSLIFY 1\nvarying vec2 v_rgbNW;\nvarying vec2 v_rgbNE;\nvarying vec2 v_rgbSW;\nvarying vec2 v_rgbSE;\nvarying vec2 v_rgbM;\nuniform vec2 iResolution;\nattribute vec2 position;\nvarying vec2 vUv;\nvoid texcoords_1_0(vec2 fragCoord, vec2 resolution,\nout vec2 v_rgbNW, out vec2 v_rgbNE,\nout vec2 v_rgbSW, out vec2 v_rgbSE,\nout vec2 v_rgbM) {\nvec2 inverseVP = 1.0 / resolution.xy;\nv_rgbNW = (fragCoord + vec2(-1.0, -1.0)) * inverseVP;\nv_rgbNE = (fragCoord + vec2(1.0, -1.0)) * inverseVP;\nv_rgbSW = (fragCoord + vec2(-1.0, 1.0)) * inverseVP;\nv_rgbSE = (fragCoord + vec2(1.0, 1.0)) * inverseVP;\nv_rgbM = vec2(fragCoord * inverseVP);\n}\nvoid main(void) {\n   gl_Position = vec4(position, 1.0, 1.0);\n   \n   \n   vUv = (position + 1.0) * 0.5;\n   vUv.y = vUv.y;\n   vec2 fragCoord = vUv * iResolution;\n   texcoords_1_0(fragCoord, iResolution, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);\n}";