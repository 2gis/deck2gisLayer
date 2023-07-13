attribute vec2 a_vec2_position;
varying vec2 v_vec2_position;
void main() {
    gl_Position = vec4(a_vec2_position, 0.0, 1.0);
    v_vec2_position = clamp(a_vec2_position, vec2(0,0), vec2(1,1));
}