module.exports = function (code) {
    const multiLineComments = /\/\*[^]*?\*\//g;
    const singleLineComments = /\/\/(.)*/g;
    const tabs = /\t/g;
    const multiNewLines = /\n[\n]*\n/g;

    const compiled = code
        .replace(multiLineComments, '')
        .replace(singleLineComments, '')
        .replace(tabs, '')
        .replace(multiNewLines, '\n');

    this.cacheable && this.cacheable();

    return 'export default ' + JSON.stringify(compiled) + ';';
};
