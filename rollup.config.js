import babel from 'rollup-plugin-babel';

export default [
    {
        input: 'src/webstomp.js',
        output: {
            dir: 'dist',
            file: 'webstomp.js',
            format: 'umd',
            name: 'webstomp'
        },
        plugins: [
            babel()
        ]
    }
];
