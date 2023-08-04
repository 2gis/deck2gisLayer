precision mediump float;
uniform sampler2D u_sr2d_texture;
varying vec2 v_vec2_position;
void main()
{
    vec4 color = texture2D(u_sr2d_texture, v_vec2_position);
    gl_FragColor = color;
}